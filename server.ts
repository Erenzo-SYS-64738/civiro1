import express from 'express';
import path from 'path';
import fs from 'fs';
import { rateLimit } from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, updateDoc, doc, setDoc, getDoc, query, orderBy } from 'firebase/firestore';
import { Ticket, Department } from './src/types';

const app = express();
const PORT = 3000;

// Set up body parsing with larger limits for base64 photo uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
  console.log("Gemini AI Client initialized successfully.");
} else {
  console.warn("GEMINI_API_KEY is not defined. Fallback rule-based analysis will be used.");
}

// Initialize Firebase Client
let db: any = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const firebaseConfig = {
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId
    };
    const firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp, config.firestoreDatabaseId);
    console.log("Firestore client initialized successfully database ID:", config.firestoreDatabaseId);
  } else {
    console.warn("firebase-applet-config.json not found. Database operations will fail!");
  }
} catch (e) {
  console.error("Error initializing Firebase Client:", e);
}

// Seed hardcoded departments if empty
async function seedDepartmentsIfNeeded() {
  if (!db) return;
  try {
    const deptsCol = collection(db, 'departments');
    const snapshot = await getDocs(deptsCol);
    if (snapshot.empty) {
      console.log("No departments found. Seeding initial departments...");
      const depts = ["Roads Dept", "Sanitation Dept", "Electrical Dept"];
      for (const dept of depts) {
        await setDoc(doc(db, 'departments', dept), {
          name: dept,
          trust_score: 100,
          tickets_resolved_verified: 0,
          tickets_resolved_rejected: 0
        });
      }
      console.log("Departments successfully seeded.");
    }
  } catch (e) {
    console.error("Error seeding departments:", e);
  }
}

// Call seed departments on launch
seedDepartmentsIfNeeded();

// API Routes

// Get all tickets
app.get('/api/tickets', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Firestore is not initialized.' });
    }
    const ticketsCol = collection(db, 'tickets');
    const q = query(ticketsCol, orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    const tickets: Ticket[] = [];
    snapshot.forEach((docSnap) => {
      tickets.push({ id: docSnap.id, ...docSnap.data() } as Ticket);
    });
    res.json(tickets);
  } catch (err: any) {
    console.error("Error fetching tickets:", err);
    res.status(500).json({ error: err.message || 'Failed to fetch tickets' });
  }
});

// Create a new ticket
const ticketLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many requests, please try again shortly',
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/tickets', ticketLimiter, async (req, res) => {
  try {
    const { description, photo_before_url, lat, lng } = req.body;

    if (!description || description.trim().length < 3) {
      return res.status(400).json({ error: 'Description is required and must be at least 3 characters.' });
    }
    if (!photo_before_url || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'Missing required fields: photo_before_url, lat, and lng are required.' });
    }

    // Image size check
    let base64Data = photo_before_url;
    if (photo_before_url.startsWith('data:')) {
      base64Data = photo_before_url.split(',')[1];
    }
    const sizeInBytes = (base64Data.length * 3) / 4;
    if (sizeInBytes > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image file size exceeds the 2MB limit.' });
    }

    if (!db) {
      return res.status(500).json({ error: 'Firestore is not initialized.' });
    }

    let category: 'pothole' | 'garbage' | 'streetlight' | 'water_leak' = 'pothole';
    let severity = 5;
    let department: 'Roads Dept' | 'Sanitation Dept' | 'Electrical Dept' = 'Roads Dept';
    let reasoning_log: string[] = [];
    let hasAIClassification = false;
    let hasAIDepartment = false;

    const actionTime = new Date().toLocaleTimeString();
    reasoning_log.push(`[${actionTime}] Ticket report received from citizen GPS coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)}).`);

    // AI Classification
    if (ai) {
      try {
        reasoning_log.push(`[${actionTime}] Submitting image and description to Gemini-3.1-Flash-Lite for multi-stage function calling analysis.`);
        
        let mimeType = 'image/jpeg';
        if (photo_before_url.startsWith('data:')) {
          const parts = photo_before_url.split(',');
          // base64Data is already defined above, but we need the correct part
          const mimeMatch = parts[0].match(/data:(.*?);/);
          if (mimeMatch) {
            mimeType = mimeMatch[1];
          }
        }

        const classifyImageDeclaration = {
          name: "classify_image",
          description: "Classify the reported civic issue image and description, determining its category and estimating a severity score from 1 to 10 based on urgency.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                description: "The classified civic issue category",
                enum: ["pothole", "garbage", "streetlight", "water_leak"]
              },
              severity: {
                type: Type.INTEGER,
                description: "Estimated severity score from 1 to 10 representing urgency of the issue"
              },
              reasoning: {
                type: Type.STRING,
                description: "A short explanation for the classification and severity rating"
              }
            },
            required: ["category", "severity", "reasoning"]
          }
        };

        const assignDepartmentDeclaration = {
          name: "assign_department",
          description: "Route the classified category to the appropriate department: roads, sanitation, or electrical.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                description: "The classified category (must be one of: pothole, garbage, streetlight, water_leak)"
              },
              department: {
                type: Type.STRING,
                description: "The mapped department name: Roads Dept (for pothole, water_leak), Sanitation Dept (for garbage), Electrical Dept (for streetlight)",
                enum: ["Roads Dept", "Sanitation Dept", "Electrical Dept"]
              },
              routingReasoning: {
                type: Type.STRING,
                description: "Short explanation of the routing mapping rule"
              }
            },
            required: ["category", "department", "routingReasoning"]
          }
        };

        const contents: any[] = [
          {
            role: "user",
            parts: [
              {
                text: `Analyze this civic issue report. The description provided is: "${description}".`
              },
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType
                }
              }
            ]
          }
        ];

        let loopCount = 0;
        while (loopCount < 5) {
          const modelResponse = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: contents,
            config: {
              systemInstruction: "You are Civiro's smart civic routing assistant. Analyze the reported civic issue image and description, classify it, and route it. ALWAYS call classify_image first, then once you receive the classification result, call assign_department to assign the department. Finally, summarize the decisions and explain why.",
              tools: [{
                functionDeclarations: [classifyImageDeclaration, assignDepartmentDeclaration]
              }]
            }
          });

          if (modelResponse.candidates?.[0]?.content) {
            contents.push(modelResponse.candidates[0].content);
          }

          const functionCalls = modelResponse.functionCalls;
          if (functionCalls && functionCalls.length > 0) {
            const functionResponsesParts: any[] = [];
            
            for (const call of functionCalls) {
              const { name, args, id } = call;
              console.log(`Model called function ${name} with args:`, args);
              
              let functionResult: any = null;
              if (name === "classify_image") {
                const argCategory = args.category as any;
                if (['pothole', 'garbage', 'streetlight', 'water_leak'].includes(argCategory)) {
                  category = argCategory;
                  hasAIClassification = true;
                }
                const argSeverity = Number(args.severity);
                if (argSeverity >= 1 && argSeverity <= 10) {
                  severity = argSeverity;
                }
                const explanation = args.reasoning || "Image classified successfully.";
                reasoning_log.push(`[${new Date().toLocaleTimeString()}] AI Agent classified issue as category '${category}' with severity ${severity} of 10. Reason: ${explanation}`);
                
                functionResult = {
                  success: true,
                  category,
                  severity,
                  reasoning: explanation
                };
              } else if (name === "assign_department") {
                const argDept = args.department as any;
                if (['Roads Dept', 'Sanitation Dept', 'Electrical Dept'].includes(argDept)) {
                  department = argDept;
                  hasAIDepartment = true;
                }
                const routingReasoning = args.routingReasoning || "Routed to department based on category.";
                reasoning_log.push(`[${new Date().toLocaleTimeString()}] AI Agent routed issue to department '${department}'. Reason: ${routingReasoning}`);
                
                functionResult = {
                  success: true,
                  category: args.category,
                  department,
                  routingReasoning
                };
              } else {
                functionResult = { error: "Unknown function" };
              }

              functionResponsesParts.push({
                functionResponse: {
                  name: name,
                  response: functionResult,
                  id: id
                }
              });
            }

            contents.push({
              role: "tool",
              parts: functionResponsesParts
            });

            loopCount++;
          } else {
            if (modelResponse.text) {
              reasoning_log.push(`[${new Date().toLocaleTimeString()}] AI Summary: ${modelResponse.text.trim()}`);
            }
            break;
          }
        }
      } catch (geminiErr: any) {
        console.error('Gemini function calling failed, falling back to rule-based classification:', geminiErr);
        const errMsg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
        reasoning_log.push(`[${actionTime}] AI service error during function calling: ${errMsg}. Switched automatically to rule-based fallback classification.`);
        
        if (hasAIClassification && hasAIDepartment) {
          reasoning_log.push(`[${actionTime}] Successfully preserved AI-agent classified category ('${category}'), department ('${department}'), and severity (${severity}) because function calls completed successfully prior to the error.`);
        } else if (hasAIClassification) {
          if (category === 'pothole' || category === 'water_leak') {
            department = 'Roads Dept';
          } else if (category === 'garbage') {
            department = 'Sanitation Dept';
          } else if (category === 'streetlight') {
            department = 'Electrical Dept';
          }
          reasoning_log.push(`[${actionTime}] Preserved AI-agent classification category ('${category}') and severity (${severity}). Since department assignment failed, mapped category to department '${department}' using system routing rules.`);
        } else {
          const descLower = description.toLowerCase();
          if (descLower.includes('light') || descLower.includes('lamp') || descLower.includes('electric') || descLower.includes('dark')) {
            category = 'streetlight';
            department = 'Electrical Dept';
            severity = 6;
          } else if (descLower.includes('trash') || descLower.includes('garbage') || descLower.includes('dump') || descLower.includes('litter')) {
            category = 'garbage';
            department = 'Sanitation Dept';
            severity = 4;
          } else if (descLower.includes('water') || descLower.includes('leak') || descLower.includes('pipe') || descLower.includes('flood')) {
            category = 'water_leak';
            department = 'Roads Dept';
            severity = 7;
          } else {
            category = 'pothole';
            department = 'Roads Dept';
            severity = 5;
          }
          reasoning_log.push(`[${actionTime}] Rule engine matched keywords and routed to ${department} (Severity ${severity}).`);
        }
      }
    } else {
      reasoning_log.push(`[${actionTime}] Gemini API key not present. Triggering rule-based failover routing.`);
      
      const descLower = description.toLowerCase();
      if (descLower.includes('light') || descLower.includes('lamp') || descLower.includes('electric') || descLower.includes('dark')) {
        category = 'streetlight';
        department = 'Electrical Dept';
        severity = 6;
      } else if (descLower.includes('trash') || descLower.includes('garbage') || descLower.includes('dump') || descLower.includes('litter')) {
        category = 'garbage';
        department = 'Sanitation Dept';
        severity = 4;
      } else if (descLower.includes('water') || descLower.includes('leak') || descLower.includes('pipe') || descLower.includes('flood')) {
        category = 'water_leak';
        department = 'Roads Dept';
        severity = 7;
      } else {
        category = 'pothole';
        department = 'Roads Dept';
        severity = 5;
      }
      reasoning_log.push(`[${actionTime}] Rule engine completed failover matching to ${department}.`);
    }

    const newTicketData = {
      photo_before_url,
      photo_after_url: null,
      description,
      category,
      severity,
      department,
      status: 'Open',
      lat,
      lng,
      created_at: new Date().toISOString(),
      resolved_claimed_at: null,
      reasoning_log,
      trust_impact: 0
    };

    const ticketsCol = collection(db, 'tickets');
    const docRef = await addDoc(ticketsCol, newTicketData);
    await updateDoc(docRef, { id: docRef.id });

    const finalTicket = { id: docRef.id, ...newTicketData };
    res.status(201).json(finalTicket);
  } catch (err: any) {
    console.error('Error creating ticket:', err);
    res.status(500).json({ error: err.message || 'Failed to create ticket' });
  }
});

// Mark ticket as resolved by department (claims resolution) and triggers Autonomous Verification Agent
app.post('/api/tickets/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { photo_after_url } = req.body;

    if (!photo_after_url) {
      return res.status(400).json({ error: 'Photo verification is required to claim resolution.' });
    }

    if (!db) {
      return res.status(500).json({ error: 'Firestore is not initialized.' });
    }

    const ticketRef = doc(db, 'tickets', id);
    const ticketSnap = await getDoc(ticketRef);

    if (!ticketSnap.exists()) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = ticketSnap.data() as Ticket;
    const actionTime = new Date().toLocaleTimeString();
    let updatedReasoning = [
      ...ticket.reasoning_log,
      `[${actionTime}] ${ticket.department} completed field work and claimed resolution with verification photo.`
    ];

    const resolvedTime = new Date().toISOString();
    
    // Step 1: Temporarily transition ticket status to 'Resolved Claimed' in Firestore
    await updateDoc(ticketRef, {
      status: 'Resolved Claimed',
      photo_after_url,
      resolved_claimed_at: resolvedTime,
      reasoning_log: updatedReasoning
    });

    let currentStatus = 'Resolved Claimed';
    let trustImpact = 0;

    // Step 2: Trigger the Autonomous Verification Agent
    if (ai) {
      try {
        const actionTimeVerification = new Date().toLocaleTimeString();
        updatedReasoning.push(`[${actionTimeVerification}] Submitting before & after images to Gemini-3.1-Flash-Lite for autonomous verification.`);
        
        const parseBase64Url = (url: string) => {
          let base64Data = url;
          let mimeType = 'image/jpeg';
          if (url.startsWith('data:')) {
            const parts = url.split(',');
            base64Data = parts[1];
            const mimeMatch = parts[0].match(/data:(.*?);/);
            if (mimeMatch) {
              mimeType = mimeMatch[1];
            }
          }
          return { base64Data, mimeType };
        };

        const { base64Data: beforeBase64, mimeType: beforeMime } = parseBase64Url(ticket.photo_before_url);
        const { base64Data: afterBase64, mimeType: afterMime } = parseBase64Url(photo_after_url);

        const compareBeforeAfterDeclaration = {
          name: "compare_before_after",
          description: "Compare the 'before' issue photo with the 'after' resolution photo to determine if the reported civic issue has been resolved successfully.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              verdict: {
                type: Type.STRING,
                description: "The verdict of the comparison: 'resolved' (issue is fixed/cleaned/repaired), 'not_resolved' (issue is not fixed/identical to before/still exists), or 'uncertain' (unclear state/irrelevant photos)",
                enum: ["resolved", "not_resolved", "uncertain"]
              },
              confidence: {
                type: Type.INTEGER,
                description: "Confidence percentage of the verdict from 0 to 100."
              },
              reasoning: {
                type: Type.STRING,
                description: "Detailed step-by-step reasoning explaining the comparison and verdict."
              }
            },
            required: ["verdict", "confidence", "reasoning"]
          }
        };

        const contents: any[] = [
          {
            role: "user",
            parts: [
              {
                text: `You are Civiro's Autonomous Verification Agent. Compare the 'before' and 'after' images for the civic issue described as: "${ticket.description}" under category "${ticket.category}". Determine if the issue has been fully and properly resolved. Execute the function compare_before_after to submit your verdict.`
              },
              {
                text: "Before photo (reported civic issue):"
              },
              {
                inlineData: {
                  data: beforeBase64,
                  mimeType: beforeMime
                }
              },
              {
                text: "After photo (resolution claim):"
              },
              {
                inlineData: {
                  data: afterBase64,
                  mimeType: afterMime
                }
              }
            ]
          }
        ];

        let loopCount = 0;
        let verdict: 'resolved' | 'not_resolved' | 'uncertain' = 'uncertain';
        let confidence = 0;
        let reasoning = '';
        let hasDecision = false;

        while (loopCount < 5) {
          const modelResponse = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: contents,
            config: {
              systemInstruction: "You are Civiro's Autonomous Verification Agent. Your job is to strictly compare the before and after photos. Call the compare_before_after function with your verdict, confidence score, and reasoning. Be rigorous — only approve (verdict: resolved) if the before and after photos clearly show that the issue was fixed. If the after photo is identical, unrelated, or doesn't show a fix, output verdict: not_resolved.",
              tools: [{
                functionDeclarations: [compareBeforeAfterDeclaration]
              }]
            }
          });

          if (modelResponse.candidates?.[0]?.content) {
            contents.push(modelResponse.candidates[0].content);
          }

          const functionCalls = modelResponse.functionCalls;
          if (functionCalls && functionCalls.length > 0) {
            const functionResponsesParts: any[] = [];
            
            for (const call of functionCalls) {
              const { name, args, id: callId } = call;
              console.log(`Verification Agent called function ${name} with args:`, args);
              
              let functionResult: any = null;
              if (name === "compare_before_after") {
                const argVerdict = args.verdict as any;
                if (['resolved', 'not_resolved', 'uncertain'].includes(argVerdict)) {
                  verdict = argVerdict;
                }
                const argConfidence = Number(args.confidence);
                if (argConfidence >= 0 && argConfidence <= 100) {
                  confidence = argConfidence;
                }
                reasoning = (args.reasoning as string) || "Comparison completed.";
                hasDecision = true;

                functionResult = {
                  success: true,
                  verdict,
                  confidence,
                  reasoning
                };
              } else {
                functionResult = { error: "Unknown function" };
              }

              functionResponsesParts.push({
                functionResponse: {
                  name: name,
                  response: functionResult,
                  id: callId
                }
              });
            }

            contents.push({
              role: "tool",
              parts: functionResponsesParts
            });

            loopCount++;
          } else {
            break;
          }
        }

        if (hasDecision) {
          const actionTimeResult = new Date().toLocaleTimeString();
          updatedReasoning.push(`[${actionTimeResult}] AI Verification Agent completed analysis. Verdict: '${verdict}', Confidence: ${confidence}%. Reasoning: ${reasoning}`);
          
          if (verdict === 'resolved' && confidence > 70) {
            currentStatus = 'Verified Resolved';
            trustImpact = 2;
            
            // Update Department Trust Score (+2)
            const deptRef = doc(db, 'departments', ticket.department);
            const deptSnap = await getDoc(deptRef);
            if (deptSnap.exists()) {
              const dept = deptSnap.data();
              await updateDoc(deptRef, {
                trust_score: (dept.trust_score || 100) + 2,
                tickets_resolved_verified: (dept.tickets_resolved_verified || 0) + 1
              });
            }
          } else {
            currentStatus = 'Reopened';
            trustImpact = -5;
            
            // Update Department Trust Score (-5)
            const deptRef = doc(db, 'departments', ticket.department);
            const deptSnap = await getDoc(deptRef);
            if (deptSnap.exists()) {
              const dept = deptSnap.data();
              await updateDoc(deptRef, {
                trust_score: Math.max(0, (dept.trust_score || 100) - 5),
                tickets_resolved_rejected: (dept.tickets_resolved_rejected || 0) + 1
              });
            }
          }
        } else {
          // No function call was made by model, fallback to reopened
          const actionTimeResult = new Date().toLocaleTimeString();
          updatedReasoning.push(`[${actionTimeResult}] Autonomous Verification Agent failed to return a valid verification verdict. Reopening ticket under zero-trust verification policy.`);
          currentStatus = 'Reopened';
          trustImpact = -5;
          
          const deptRef = doc(db, 'departments', ticket.department);
          const deptSnap = await getDoc(deptRef);
          if (deptSnap.exists()) {
            const dept = deptSnap.data();
            await updateDoc(deptRef, {
              trust_score: Math.max(0, (dept.trust_score || 100) - 5),
              tickets_resolved_rejected: (dept.tickets_resolved_rejected || 0) + 1
            });
          }
        }
      } catch (geminiErr: any) {
        console.error('Autonomous verification failed:', geminiErr);
        const actionTimeResult = new Date().toLocaleTimeString();
        const errMsg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
        updatedReasoning.push(`[${actionTimeResult}] Autonomous Verification Agent error: ${errMsg}. Reopening ticket under zero-trust verification policy.`);
        currentStatus = 'Reopened';
        trustImpact = -5;
        
        const deptRef = doc(db, 'departments', ticket.department);
        const deptSnap = await getDoc(deptRef);
        if (deptSnap.exists()) {
          const dept = deptSnap.data();
          await updateDoc(deptRef, {
            trust_score: Math.max(0, (dept.trust_score || 100) - 5),
            tickets_resolved_rejected: (dept.tickets_resolved_rejected || 0) + 1
          });
        }
      }
    } else {
      // No GEMINI_API_KEY
      const actionTimeResult = new Date().toLocaleTimeString();
      updatedReasoning.push(`[${actionTimeResult}] GEMINI_API_KEY is not configured. Unable to run Autonomous Verification. Reopening ticket under zero-trust verification policy.`);
      currentStatus = 'Reopened';
      trustImpact = -5;
      
      const deptRef = doc(db, 'departments', ticket.department);
      const deptSnap = await getDoc(deptRef);
      if (deptSnap.exists()) {
        const dept = deptSnap.data();
        await updateDoc(deptRef, {
          trust_score: Math.max(0, (dept.trust_score || 100) - 5),
          tickets_resolved_rejected: (dept.tickets_resolved_rejected || 0) + 1
        });
      }
    }

    // Step 3: Final state transition and metadata save
    const finalUpdate: any = {
      status: currentStatus,
      trust_impact: trustImpact,
      reasoning_log: updatedReasoning
    };
    
    if (currentStatus === 'Reopened') {
      finalUpdate.photo_after_url = null;
      finalUpdate.resolved_claimed_at = null;
    }
    
    await updateDoc(ticketRef, finalUpdate);

    res.json({
      ...ticket,
      id,
      status: currentStatus,
      photo_after_url: currentStatus === 'Reopened' ? null : photo_after_url,
      resolved_claimed_at: currentStatus === 'Reopened' ? null : resolvedTime,
      trust_impact: trustImpact,
      reasoning_log: updatedReasoning
    });
  } catch (err: any) {
    console.error('Error resolving/verifying ticket:', err);
    res.status(500).json({ error: err.message || 'Failed to process ticket resolution' });
  }
});

// Get all department trust statistics
app.get('/api/departments', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Firestore is not initialized.' });
    }
    const deptsCol = collection(db, 'departments');
    const snapshot = await getDocs(deptsCol);
    const departments: Department[] = [];
    snapshot.forEach((docSnap) => {
      departments.push(docSnap.data() as Department);
    });
    res.json(departments);
  } catch (err: any) {
    console.error("Error fetching departments:", err);
    res.status(500).json({ error: err.message || 'Failed to fetch departments' });
  }
});

// Serve static assets / Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
