# 10X Marketing Solutions — website

A single-page marketing site for 10X Marketing Solutions, built with React, TypeScript and Vite.

It is **frontend only**. It has no backend, analytics, cookies or network requests, and it stores no personal data. The project enquiry panel builds a summary that visitors can copy, but it **does not send anything**.

## Getting started

Requires Node.js 20 or later.

```bash
npm install
npm run dev        # local dev server at http://localhost:5173
npm run typecheck  # TypeScript only
npm run build      # type check + production build into dist/
npm run preview    # serve the production build locally
```

`dist/` is a static site that can be served from any static host. It has not been deployed.

## Project structure

```
src/
  content/site.ts        ← all editable copy, services, projects, contact details
  assets/brand/logo.png  ← official logo (used as-is on a white plate)
  styles/theme.css       ← design tokens: colours, type scale, spacing, motion
  styles/global.css      ← reset and shared utilities (.btn, .container, …)
  components/            ← one component + CSS module per section
  context/EnquiryContext ← opens the enquiry panel from anywhere, with presets
public/                  ← favicons (cropped from the official logo mark)
```

## Editing content

Almost everything you'll want to change is in **`src/content/site.ts`**, with a comment on each block.

- **Hero, capability tabs, section headings and About copy:** edit the strings in place.
- **Services:** the `services` array. Each item has `discipline` (`marketing` or `software`), `name`, `outcome` and `scope`. Row numbers are generated automatically. The `id` is used to preselect the service in the enquiry panel, so keep ids unique.
- **Approach stages:** the `approach.stages` array.
- **Enquiry timelines:** the `timelines` array.

### Contact details

The Contact section shows the literal placeholders **[Your email address]** and **[Your phone number]**. They are deliberately not links. To go live, set real values:

```ts
contact: {
  email: 'hello@yourdomain.com',
  phone: '+00 000 000 0000',
  …
}
```

Once a value is set, it becomes a working `mailto:` or `tel:` link. Don't add a physical address or location. The brief excludes them.

### Projects (Work section)

The three current projects are **concept projects**. They are illustrations of approach, not client work, and are labelled "Concept project" throughout. To add real work, edit the `projects` array:

- Set `isConcept: false` to remove the concept label for real client work. Only do this when you have permission to show the work.
- Add an approved image in `public/work/` and reference it:
  ```ts
  image: { src: '/work/brand-launch.webp', alt: 'Describe the image', width: 1600, height: 1000 },
  ```
  When `image` is set it replaces the built-in illustrated visual.
- `disciplines` (`marketing`, `software` or both) controls which filters show the project, and `category` is the small label above the title. Layout slots (feature, wide, narrow) are assigned by order.

Don't add client names, results, metrics or testimonials unless they are real and approved.

## Replacing assets

- **Logo:** replace `src/assets/brand/logo.png` with the official file. Keep the white background, because the logo is placed on a white plate and must not be recoloured or distorted. Height is set in `src/components/Logo.module.css`, and the width follows the image's aspect ratio.
- **Favicons:** `public/favicon-32.png`, `public/favicon.png` (64px) and `public/apple-touch-icon.png` (180px) are crops of the logo mark on white. Replace them if the logo changes.
- **Hero sculpture:** `src/components/BrandSculpture.tsx` is decorative SVG art inspired by the mark. It is not the logo. It floats gently, tilts slightly with the pointer on mouse or trackpad devices, and has a pause control. It is static when reduced motion is enabled.
- **Fonts:** Manrope (display) and Inter (body) are bundled locally through `@fontsource-variable`. No external font requests are made.

## Enquiry panel

"Start a project" and the "Discuss …" buttons open a three-step panel: area of work, project details, and contact details. The panel then offers a review and a preview. It validates each step, keeps entries when moving back and forth, and can be reset.

The final screen states that **nothing has been sent** and offers **Copy enquiry**. If the clipboard is unavailable, it shows the text in a selectable field instead.

Submissions are **intentionally not connected**. To accept enquiries later, add a form service or API call in `src/components/ProjectEnquiry.tsx`, replace the preview step, and update the privacy wording to match.

## Accessibility and motion

- Skip link, a single `h1`, visible focus styles and 44px touch targets.
- Dialogs (the mobile menu, project details and the enquiry) trap focus, close with Escape, lock page scroll and return focus to the control that opened them.
- `prefers-reduced-motion` is respected everywhere through `MotionConfig reducedMotion="user"` and CSS overrides.
- Tested for no horizontal overflow at 360, 390, 768, 1024 and 1440px widths.
