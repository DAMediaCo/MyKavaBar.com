import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import "../styles/slider.css";

export default function Welcome() {
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
          slidesToScroll: 1,
        },
      },
    ],
  };

  const secondGalleryImages = [
    { src: "/images/islandvibes.png", alt: "Kava Bar 2" },
    { src: "/images/tf.jpg", alt: "Kava Bar 3" },
    { src: "/images/costal.png", alt: "Kava Bar 4" },
    { src: "/images/kp.png", alt: "Kava Bar 4" },
    { src: "/images/twinfalme.png", alt: "Kava Bar 5" },
    { src: "/images/zenc.jpg", alt: "Kava Bar 6" },
    { src: "/images/costalgirl.jpg", alt: "Kava Bar 6" },
  ];

  return (
    <div className="container mx-auto px-4 py-8 space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-[#12e0d4]">
          Welcome to MyKavaBar
        </h1>
        <p className="text-2xl font-bold text-muted-foreground max-w-3xl mx-auto text-[#f8119f]">
          KAVA NEAR ME? WE KNOW
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div className="space-y-4">
          <h2 className="text-3xl font-bold text-[#f8119f]">About MyKavaBar</h2>
          <p className="text-lg">
            It started with a craving — not just for kava, but for connection.
            After drinking kava and kratom for a few years, I realized there was
            no easy way to find local bars or explore new ones while traveling.
            I wanted a single place where the whole kava community could come
            together — so I decided to build it. I’m David Miller, founder of
            MyKavaBar.com. I’ve always been a bit of a tech nerd (even without
            coding skills), and I had a clear vision of what I wanted to see in
            the world. I hacked together version one of the site to solve my own
            problem — a basic directory to track where to sip next.{" "}
          </p>
          <br></br>
          <p className="text-lg">
            Not long after, I met Jason Krabs at a local kava bar. We connected
            instantly over a shared love of the scene and the potential to do
            something bigger. Jason brought in his friend Christian Wilson, and
            the three of us decided to team up, officially forming MyKavaBar LLC
            and becoming co-founders. Jason is the kind of developer who sees
            clean solutions before you even realize there’s a problem — he leads
            our backend. Christian brings the frontend to life with a passion
            for intuitive design and user-first experiences. I focus on
            outreach, marketing, and helping the business grow.{" "}
          </p>
          <br></br>
          <p className="text-lg">
            Together, we launched version two — a faster, smarter, more powerful
            platform — with plenty more on the way. But this isn’t just about
            tech. It’s about impact. We’re helping small businesses thrive,
            making kava culture more accessible, and giving people a better way
            to explore the calm, connection, and community that kava brings.
            Whether you’re a longtime drinker or just discovering your first
            shell — we built this for you. Dive in, explore, and help us grow
            something amazing.
          </p>
          <p className="text-lg">
            Our mission is to connect the kava world — one bar, one sip, one
            community at a time.
          </p>
        </div>
        <div className="rounded-lg overflow-hidden shadow-xl">
          <img
            src="/images/chiyo.png"
            alt="Kava Experience"
            className="w-full h-auto object-cover"
          />
        </div>
      </div>

      <div className="py-8">
        <h2 className="text-2xl font-bold mb-6 text-center text-[#f8119f]">
          Partner Kava Bars Across South Florida
        </h2>
        <div className="slider-container">
          <Slider {...secondGallerySettings}>
            {secondGalleryImages.map((image, index) => (
              <div key={index} className="px-2">
                <div className="rounded-lg overflow-hidden shadow-md">
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-auto object-cover"
                  />
                </div>
              </div>
            ))}
          </Slider>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-center text-[#f8119f]">
          Key Features
        </h2>
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

      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-center text-[#f8119f]">
          Our Roadmap
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Q3 2025</h3>
            <ul className="space-y-3 list-disc pl-5">
              <li>My Kava Bar 2.0 </li>
              <li>
                Kavatender reviews - leave reviews for your favorite kavatender.
              </li>
              <li>Kava Bar Socials</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Q4 2025</h3>
            <ul className="space-y-3 list-disc pl-5">
              <li>Local Event Calendar, find events in Kava Bars near you</li>
              <li>Push Notifications</li>
              <li>User Badges and Achievements</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Q1 2026</h3>
            <ul className="space-y-3 list-disc pl-5">
              <li>Introduce virtual kava tasting events</li>
              <li>Launch Discord community</li>
              <li>Add AR features for in-app kava bar exploration</li>
              <li>Develop API for third-party integrations</li>
            </ul>
          </div>

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

      <div className="text-center py-8">
        <h2 className="text-3xl font-bold mb-4 text-[#f8119f]">
          Join Our Community Today
        </h2>
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
    </div>
  );
}
