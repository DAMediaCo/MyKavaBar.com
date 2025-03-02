
import React, { useEffect } from 'react';

export default function PrivacyPolicy() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://app.termly.io/embed-policy.min.js";
    script.id = "termly-jssdk";
    document.body.appendChild(script);
    
    return () => {
      const existingScript = document.getElementById('termly-jssdk');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="prose prose-sm sm:prose lg:prose-lg mx-auto">
        <h1 className="text-3xl font-bold mb-8">PRIVACY POLICY</h1>
        <div 
          name="termly-embed" 
          data-id="17369f28-ff66-410e-92fe-daa57fabaeb3"
        />
      </div>
    </div>
  );
}
