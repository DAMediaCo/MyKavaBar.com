import { useEffect, useRef } from 'react';

export default function TermsOfService() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const existingScript = document.getElementById('termly-jssdk');
    if (existingScript) {
      existingScript.remove();
    }

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      const embedDiv = document.createElement('div');
      embedDiv.setAttribute('name', 'termly-embed');
      embedDiv.setAttribute('data-id', '402e9d0b-6f44-40e3-a9fe-d2e87c5abab2');
      containerRef.current.appendChild(embedDiv);
    }

    const script = document.createElement('script');
    script.src = 'https://app.termly.io/embed-policy.min.js';
    script.id = 'termly-jssdk';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      const scriptToRemove = document.getElementById('termly-jssdk');
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#121212] py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8 text-white">Terms of Service</h1>
        <div 
          ref={containerRef}
          className="termly-embed-container bg-white rounded-lg p-6"
        />
      </div>
    </div>
  );
}
