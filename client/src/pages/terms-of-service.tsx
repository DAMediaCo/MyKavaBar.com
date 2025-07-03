import React, { useEffect } from "react";

export default function TermsOfService() {
  useEffect(() => {
    // Load the Termly embed script
    const script = document.createElement("script");
    script.src = "https://app.termly.io/embed-policy.min.js";
    script.id = "termly-jssdk";
    document.body.appendChild(script);

    // Function to apply dark mode styles
    const applyDarkMode = () => {
      const embed = document.querySelector("[name='termly-embed']");
      if (embed) {
        embed.querySelectorAll("*").forEach((el) => {
          (el as HTMLElement).style.color = "white";
          (el as HTMLElement).style.backgroundColor = "transparent";
        });
      }
    };

    // Polling interval to wait until the embed is loaded
    const interval = setInterval(() => {
      const embed = document.querySelector("[name='termly-embed']");
      if (embed && embed.children.length > 0) {
        if (document.documentElement.classList.contains("dark")) {
          applyDarkMode();
        }
        clearInterval(interval);
      }
    }, 500);

    // Clear on unmount
    return () => {
      const existingScript = document.getElementById("termly-jssdk");
      if (existingScript) {
        existingScript.remove();
      }
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="prose prose-sm sm:prose lg:prose-lg mx-auto">
        <h1 className="text-3xl font-bold mb-8 dark:text-white">
          TERMS OF SERVICE
        </h1>
        <div
          name="termly-embed"
          data-id="402e9d0b-6f44-40e3-a9fe-d2e87c5abab2"
          className="termly-wrapper"
        />
      </div>
    </div>
  );
}
