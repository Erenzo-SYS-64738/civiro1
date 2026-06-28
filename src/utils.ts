// Compress and resize image file to a max width/height of 800px and return base64
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string); // fallback
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        // Get high-quality JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      };
      img.onerror = () => {
        reject(new Error('Failed to load image file'));
      };
    };
    reader.onerror = (error) => reject(error);
  });
}

// Map categories to beautiful Tailwind colors & Lucide icon pairings
export function getCategoryMeta(category: string) {
  switch (category) {
    case 'pothole':
      return {
        label: 'Pothole',
        color: 'rose',
        bg: 'bg-rose-50 text-rose-700 border-rose-100',
        badge: 'bg-rose-500 text-white',
        icon: 'Hammer'
      };
    case 'streetlight':
      return {
        label: 'Streetlight',
        color: 'amber',
        bg: 'bg-amber-50 text-amber-700 border-amber-100',
        badge: 'bg-amber-500 text-white',
        icon: 'Lightbulb'
      };
    case 'garbage':
      return {
        label: 'Garbage',
        color: 'orange',
        bg: 'bg-orange-50 text-orange-700 border-orange-100',
        badge: 'bg-orange-500 text-white',
        icon: 'Trash2'
      };
    case 'water_leak':
      return {
        label: 'Water Leak',
        color: 'blue',
        bg: 'bg-blue-50 text-blue-700 border-blue-100',
        badge: 'bg-blue-500 text-white',
        icon: 'Droplets'
      };
    default:
      return {
        label: category || 'General',
        color: 'gray',
        bg: 'bg-gray-50 text-gray-700 border-gray-100',
        badge: 'bg-gray-500 text-white',
        icon: 'AlertTriangle'
      };
  }
}

// Generate a random stable user identifier saved in localStorage
export function generateUserIdentifier(): string {
  let uid = localStorage.getItem('civiro_user_id');
  if (!uid) {
    uid = 'user_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('civiro_user_id', uid);
  }
  return uid;
}

// Generate a random stable citizen nickname saved in localStorage
export function generateUserName(): string {
  let name = localStorage.getItem('civiro_user_name');
  if (!name) {
    name = 'Resident-' + Math.floor(1000 + Math.random() * 9000);
    localStorage.setItem('civiro_user_name', name);
  }
  return name;
}
