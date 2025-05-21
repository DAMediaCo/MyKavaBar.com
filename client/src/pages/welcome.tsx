import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Welcome() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Welcome to MyKavaBar</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          The premier platform connecting kava enthusiasts with local experiences through intelligent geolocation and community-driven interactions.
        </p>
      </div>

      {/* About Section with Image */}
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div className="space-y-4">
          <h2 className="text-3xl font-bold">About MyKavaBar</h2>
          <p className="text-lg">
            MyKavaBar is a progressive discovery platform designed to help enthusiasts find and connect with kava bars across the United States. We leverage cutting-edge technology to enhance your kava experience.
          </p>
          <p className="text-lg">
            Our mission is to build a vibrant community of kava lovers who can share experiences, discover new venues, and support local kava bars.
          </p>
        </div>
        <div className="rounded-lg overflow-hidden shadow-xl">
          <img 
            src="/images/kava-experience.jpg" 
            alt="Kava Experience" 
            className="w-full h-auto object-cover"
            onError={(e) => {
              e.currentTarget.src = "https://images.unsplash.com/photo-1543363950-c78545037afc?q=80&w=800&auto=format&fit=crop";
            }}
          />
        </div>
      </div>

      {/* Features Cards */}
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-center">Key Features</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Intelligent Geolocation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                Find kava bars near you with our advanced location services powered by Google Maps integration.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Community Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                See what other enthusiasts have to say about local kava bars and share your own experiences.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verified Listings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                All kava bars are verified to ensure you get accurate and up-to-date information.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Roadmap Section */}
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-center">Our Roadmap</h2>
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left side - Q3 2025 */}
          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Q3 2025</h3>
            <ul className="space-y-3 list-disc pl-5">
              <li>Launch mobile app on iOS and Android</li>
              <li>Implement user check-ins with rewards system</li>
              <li>Add personalized recommendations based on preferences</li>
              <li>Expand to international locations</li>
            </ul>
          </div>

          {/* Right side - Q4 2025 */}
          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Q4 2025</h3>
            <ul className="space-y-3 list-disc pl-5">
              <li>Introduce educational resources about kava varieties</li>
              <li>Add events and meetups functionality</li>
              <li>Launch Kava Bar Owner dashboard with advanced analytics</li>
              <li>Implement loyalty program integration with local kava bars</li>
            </ul>
          </div>

          {/* Left side - Q1 2026 */}
          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Q1 2026</h3>
            <ul className="space-y-3 list-disc pl-5">
              <li>Introduce virtual kava tasting events</li>
              <li>Launch community forum for kava discussions</li>
              <li>Add AR features for in-app kava bar exploration</li>
              <li>Develop API for third-party integrations</li>
            </ul>
          </div>

          {/* Right side - Q2 2026 */}
          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Q2 2026</h3>
            <ul className="space-y-3 list-disc pl-5">
              <li>Release premium subscription with exclusive benefits</li>
              <li>Launch kava marketplace for home enthusiasts</li>
              <li>Implement AI-powered chatbot for kava recommendations</li>
              <li>Expand educational content with expert video series</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="text-center py-8">
        <h2 className="text-3xl font-bold mb-4">Join Our Community Today</h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-6">
          Be part of the growing community of kava enthusiasts and discover the best kava bars in your area.
        </p>
        <a 
          href="/" 
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-lg font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Explore Kava Bars
        </a>
      </div>
    </div>
  );
}