# Kava Bar Directory Platform - Design Guidelines

## Design Approach
**Selected Approach**: Reference-based, drawing from premium directory platforms (Airbnb's card system, Yelp's review patterns) combined with nightlife/social venue aesthetics. The dark premium theme creates an intimate, lounge-like browsing experience.

## Typography System (Poppins via Google Fonts)

**Hierarchy**:
- Hero Titles: 600 weight, 3.5rem (mobile: 2.5rem)
- Page Headers: 600 weight, 2.5rem (mobile: 2rem)  
- Section Titles: 600 weight, 1.75rem
- Card Titles: 500 weight, 1.25rem
- Body Text: 400 weight, 1rem
- Captions/Meta: 400 weight, 0.875rem
- Buttons/Labels: 500 weight, 0.9375rem

## Layout & Spacing System

**Tailwind Spacing Primitives**: Use units of 2, 4, 6, 8, 12, 16, 20 consistently
- Component padding: p-6 to p-8
- Card gaps: gap-6 to gap-8
- Section spacing: py-16 to py-20
- Container max-width: max-w-7xl with px-6

## Core Components

### Directory Cards
- 16px border radius on all cards
- Aspect ratio 16:9 for hero images
- Two-column grid (lg:grid-cols-2), single column mobile
- Hover: Translate up 4px (transform -translate-y-1) with enhanced shadow
- Image overlay gradient: linear from transparent to 40% black at bottom
- Overlay badges positioned top-right with 12px margin

### Navigation
- Sticky header with backdrop blur
- Logo left, search bar center (max-w-xl), user actions right
- Mobile: Hamburger menu, centered logo, search icon
- Secondary nav for filters below header (categories, location, features)

### Status Indicators
- Circular rating badges: 48px diameter, centered amber text on transparent background with amber border
- Status pills: Small rounded-full badges (px-3 py-1), vivid green background
- Position ratings top-left on card images, status badges adjacent

### Buttons & CTAs
- Primary (Clay/Orange): Rounded-lg, px-6 py-3, medium font weight
- Secondary: Outlined version with border, transparent background
- Hero CTAs over images: Add backdrop-blur-md with semi-transparent dark background
- Icon buttons: Square 40px, rounded-lg, centered icons

## Page Layouts

### Homepage
**Hero Section** (80vh):
- Full-width background image of upscale kava bar interior
- Centered search bar (max-w-2xl) with location input and "Find Kava Bars" button
- Large headline: "Discover Premium Kava Experiences" (Hero title size)
- Subheading with platform stats: "500+ Venues, 10,000+ Reviews"
- Search bar has blurred dark background (backdrop-blur-lg, bg-black/40)

**Featured Venues** (grid-cols-1 md:grid-cols-2 lg:grid-cols-2):
- 4-6 premium kava bar cards
- Each shows hero image, rating badge, status badge, title, location, price range
- Quick info icons below: Hours, atmosphere type, amenities

**Browse by Category** (grid-cols-2 md:grid-cols-4):
- Image-based category cards: Traditional, Modern, Social Lounge, Beach Vibe
- Hover overlay with category count

**Community Stats**:
- Three-column metrics (grid-cols-3): Total Venues, Reviews Posted, Active Members
- Large numbers with animated count-up effect suggestion

### Directory Listing Page
**Filter Sidebar** (left, lg:w-80):
- Sticky position
- Collapsible sections: Location, Price Range, Atmosphere, Amenities, Rating
- Checkbox groups with counts
- Apply filters button at bottom

**Results Grid** (remaining width, grid-cols-1 xl:grid-cols-2):
- Same card design as homepage
- Pagination or infinite scroll
- Sort dropdown top-right: Relevance, Rating, Distance, Newest

### Venue Detail Page
**Hero Gallery**:
- Large primary image (aspect-16/9, max-h-96)
- Thumbnail strip below (4-5 images)
- Rating and status badges overlay primary image

**Information Grid** (two-column on desktop):
- Left: About, Amenities, Hours, Reviews section
- Right: Sticky info card with quick facts, map embed, action buttons (directions, save, share)

**Reviews Component**:
- Individual review cards with user avatar, rating stars, date, text
- Filter by rating dropdown
- "Write Review" prominent CTA

## Images Strategy

### Required Images:
1. **Homepage Hero**: Atmospheric kava bar interior with warm lighting, social setting (full-width background)
2. **Venue Cards**: Each venue needs hero shot showcasing ambiance
3. **Category Cards**: 4 distinct kava bar style images
4. **Detail Page Gallery**: 5-8 images per venue (interior, drinks, seating, exterior)
5. **Review Avatars**: User profile images (circular, 40px)

**Image Treatment**: All venue images have subtle vignette effect and slight desaturation to maintain cohesive dark aesthetic.

## Interactions

- Card hover: Lift + shadow enhancement (transition-all duration-300)
- Image zoom on hover (scale-105, overflow-hidden on parent)
- Filter checkboxes: Custom styled with accent color
- Skeleton loading states for cards during fetch
- Toast notifications for actions (saved, reviewed)

**Performance**: Lazy load images below fold, use progressive JPEGs for hero images.