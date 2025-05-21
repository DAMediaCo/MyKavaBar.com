import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

export default function Welcome() {
  // Slider settings for the first gallery
  const firstGallerySettings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
        }
      },
      {
        breakpoint: 640,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1
        }
      }
    ]
  };

  // Slider settings for the second gallery
  const secondGallerySettings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 2,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 4000,
    responsive: [
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1
        }
      }
    ]
  };

  // Images for the first slider gallery
  const firstGalleryImages = [
    { src: "/images/zenc.jpg", alt: "Kava Experience 1" },
    { src: "/images/tf.jpg", alt: "Kava Experience 2" },
    { src: "/images/IMG_9330.jpg", alt: "Kava Experience 3" },
    { src: "/images/IMG_9332.jpg", alt: "Kava Experience 4" }
  ];

  // Images for the second slider gallery
  const secondGalleryImages = [
    { src: "/images/chiyo.png", alt: "Kava Bar 1" },
    { src: "/images/islandvibes.png", alt: "Kava Bar 2" },
    { src: "/images/twinfalme.png", alt: "Kava Bar 3" },
    { src: "/images/kp.png", alt: "Kava Bar 4" },
    { src: "/images/Untitled_design.png", alt: "Kava Bar 5" }
  ];

  return (
    <div className="container mx-auto px-4 py-8 space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome to MyKavaBar
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Kava Near Me? We know!
        </p>
      </div>

      {/* About Section with Image */}
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div className="space-y-4">
          <h2 className="text-3xl font-bold">About MyKavaBar</h2>
          <p className="text-lg">
            It started with a craving — not just for kava, but for connection.
            After drinking kava and kratom for a few years, I realized there was
            no easy way to find local bars or explore new ones while traveling.
            I wanted a single place where the whole kava community could come
            together — so I decided to build it. I’m David Miller, founder of
            MyKavaBar.com. I’ve always been a bit of a tech nerd (even without
            coding skills), and I had a clear vision of what I wanted to see in
            the world. I hacked together version one of the site to solve my own
            problem — a basic directory to track where to sip next. Not long
            after, I met Jason Krabs at a local kava bar. We connected instantly
            over a shared love of the scene and the potential to do something
            bigger. Jason brought in his friend Christian Wilson, and the three
            of us decided to team up, officially forming MyKavaBar LLC and
            becoming co-founders. Jason is the kind of developer who sees clean
            solutions before you even realize there’s a problem — he leads our
            backend. Christian brings the frontend to life with a passion for
            intuitive design and user-first experiences. I focus on outreach,
            marketing, and helping the business grow. Together, we launched
            version two — a faster, smarter, more powerful platform — with
            plenty more on the way. But this isn’t just about tech. It’s about
            impact. We’re helping small businesses thrive, making kava culture
            more accessible, and giving people a better way to explore the calm,
            connection, and community that kava brings. Whether you’re a
            longtime drinker or just discovering your first shell — we built
            this for you. Dive in, explore, and help us grow something amazing.
          </p>
          <p className="text-lg">
            Our mission is to connect the kava world — one bar, one sip, one
            community at a time.
          </p>
        </div>
        <div className="rounded-lg overflow-hidden shadow-xl">
          <img
            src="/images/image.jpg"
            alt="Kava Experience"
            className="w-full h-auto object-cover"
            onError={(e) => {
              e.currentTarget.src =
                "https://images.unsplash.com/photo-1543363950-c78545037afc?q=80&w=800&auto=format&fit=crop";
            }}
          />
        </div>
      </div>

      {/* First Image Gallery - after about section */}
      <div className="py-8">
        <h2 className="text-2xl font-bold mb-6 text-center">Experience the Kava Culture</h2>
        <div className="slider-container">
          <Slider {...firstGallerySettings}>
            {firstGalleryImages.map((image, index) => (
              <div key={index} className="px-2">
                <div className="rounded-lg overflow-hidden shadow-md h-64">
                  <img 
                    src={image.src} 
                    alt={image.alt} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "https://images.unsplash.com/photo-1534962409829-ada5163e4dae?q=80&w=800&auto=format&fit=crop";
                    }}
                  />
                </div>
              </div>
            ))}
          </Slider>
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
                Find kava bars near you with our advanced location services.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Community Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                See what other enthusiasts have to say about local kava bars and
                share your own experiences.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verified Listings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                All kava bars are verified to ensure you get accurate and
                up-to-date information. Events, Operating hours, and more.
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
              <li>My Kava Bar 2.0 </li>
              <li>
                KavaTender Reviews, leave reviews for your favorite kavatender.
              </li>
              <li>Kava Bar Socials</li>
            </ul>
          </div>

          {/* Right side - Q4 2025 */}
          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Q4 2025</h3>
            <ul className="space-y-3 list-disc pl-5">
              <li>Local Event Calender, find events in Kava Bars near you</li>
              <li>Push Notifications</li>
              <li>User Bages and Achievememts</li>
            </ul>
          </div>

          {/* Left side - Q1 2026 */}
          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Q1 2026</h3>
            <ul className="space-y-3 list-disc pl-5">
              <li>Introduce virtual kava tasting events</li>
              <li>Launch Discord community</li>
              <li>Add AR features for in-app kava bar exploration</li>
              <li>Develop API for third-party integrations</li>
            </ul>
          </div>

          {/* Right side - Q2 2026 */}
          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">TBA</h3>
            <ul className="space-y-3 list-disc pl-5">
              <li>Bar Pool League</li>
              <li>Bar Darts League</li>
              <li>Implement AI-powered chatbot for kava recommendations</li>
              <li>Expand educational content with expert video series</li>
              <li>Immersive Kava Bar walkthroughs</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Second Image Gallery - after roadmap section */}
      <div className="py-8">
        <h2 className="text-2xl font-bold mb-6 text-center">Discover Kava Bars Across the Country</h2>
        <div className="slider-container">
          <Slider {...secondGallerySettings}>
            {secondGalleryImages.map((image, index) => (
              <div key={index} className="px-2">
                <div className="rounded-lg overflow-hidden shadow-md h-80">
                  <img 
                    src={image.src} 
                    alt={image.alt} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?q=80&w=800&auto=format&fit=crop";
                    }}
                  />
                </div>
              </div>
            ))}
          </Slider>
        </div>
      </div>

      {/* Call to Action */}
      <div className="text-center py-8">
        <h2 className="text-3xl font-bold mb-4">Join Our Community Today</h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-6">
          Be part of the growing community of kava enthusiasts and discover the
          best kava bars in your area.
        </p>
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-lg font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Explore Kava Bars
        </a>
      </div>

      {/* Custom CSS for sliders */}
      <style jsx>{`
        .slider-container {
          margin: 0 -8px;
        }
        .slider-container .slick-dots li button:before {
          font-size: 12px;
        }
        .slider-container .slick-prev, 
        .slider-container .slick-next {
          z-index: 1;
        }
        .slider-container .slick-prev {
          left: 10px;
        }
        .slider-container .slick-next {
          right: 10px;
        }
      `}</style>
    </div>
  );
}
