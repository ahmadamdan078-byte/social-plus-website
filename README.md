# Social Plus Website

A modern, professional website for **Social Plus** — a social media and digital services brand based in Palestine.

## Quick Start

Open `index.html` in your browser, or run a local server:

```bash
cd social-plus-website
python3 -m http.server 8080
```

Then visit [http://localhost:8080](http://localhost:8080)

## Project Structure

```
social-plus-website/
├── index.html          # Main page (all sections)
├── css/
│   └── styles.css      # Styles, animations, responsive design
├── js/
│   └── main.js         # Navigation, scroll reveal, form, stats
└── assets/             # Place project images here
```

## Customization

### Replace Placeholders

| Item | Location |
|------|----------|
| WhatsApp number | `index.html` — search for `wa.me/0000000000` and `+970 XXX XXX XXX` |
| Email address | `index.html` — search for `hello@socialplus.ps` |
| Portfolio images | Replace `.portfolio-card__image` divs with `<img>` tags pointing to `assets/` |

### Portfolio Images

Replace placeholder divs with real images:

```html
<div class="portfolio-card__image">
  <img src="assets/project-1.jpg" alt="Brand Campaign Series">
</div>
```

Add this CSS for images:

```css
.portfolio-card__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

### Contact Form Backend

The form currently shows a success message on submit. Connect it to your backend, Formspree, Netlify Forms, or similar service.

## Features

- Dark premium design with purple/blue gradients
- Glassmorphism cards and smooth animations
- Sticky navigation with mobile hamburger menu
- Scroll reveal animations
- Animated statistics counter
- Fully responsive (mobile-first)
- SEO-friendly semantic HTML
- Accessible color contrast

## License

© 2026 Social Plus. All rights reserved.
