import { useEffect, useRef } from 'react';

export default function CookiePolicy() {
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
      embedDiv.setAttribute('data-id', '9fc86e73-0d7c-456f-a615-eb1c95221c66');
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
        <h1 className="text-3xl font-bold mb-8 text-white">Cookie Policy</h1>
        <div 
          ref={containerRef}
          className="termly-embed-container bg-[#1E1E1E] dark:bg-[#1E1E1E] rounded-lg p-6 [&_*]:!text-gray-200 [&_a]:!text-[#D35400] [&_h1]:!text-white [&_h2]:!text-white [&_h3]:!text-white [&_strong]:!text-white"
        />
      </div>
    </div>
  );
}
