# Clockwork prototype artwork — 17 September 2026

Seven additional source illustrations were generated with the built-in ImageGen tool. The three prepared starter illustrations remain unchanged. Source PNGs were copied intact into `assets/clockwork-rivals`; `npm run assets` derives 640px WebP versions for the browser using Sharp. No external art packs or fonts were added.

Each request used this shared prompt, with its subject inserted after `Subject:`:

> Use case: stylized-concept. Asset type: square board game card illustration for Clockwork Rivals. Subject: [subject] Style: finely detailed hand-painted watercolor and gouache with antique technical illustration character, realistic material surfaces, warm copper and aged brass, charcoal iron, restrained petrol teal accents. Composition: one isolated complete machine centered with generous pale warm ivory paper negative space around it, three-quarter view, subtle contact shadow. Soft diffuse light, inviting ingenious craftsmanship. Machine occupies 75% of image. No writing, no lettering, no labels, no frame, no decorative border, no extra background scene. Match a premium tabletop engine-building game.

| File | Subject | Generation output |
|---|---|---|
| condenser.png | A compact Victorian steam condenser with three vertical copper cooling coils, a teal glass cylinder, brass pipes and an iron base. | exec-cae3e902-7c01-47f5-9d9d-c132cd4c4304.png |
| priority-valve.png | A prominent teal handwheel with branching copper pipes and a brass pressure gauge. | exec-dbccbbee-d154-4b83-9147-1a9bfed5c0f8.png |
| flywheel.png | A large brass spoked wheel, offset crankshaft and copper bearings. | exec-ab355337-f695-462f-b035-894ffb65e98c.png |
| turbine.png | A round brass housing with partly exposed radial blades, curved pipes and a teal dial. | exec-d646556b-f11a-4f93-909a-fea1a9843751.png |
| recycler.png | A squat copper furnace with an open hopper, a few gear scraps, a coal chute and a teal lever. | exec-8889dfb8-f434-4c15-a882-79d7156e2ebe.png |
| precision-press.png | Cast-iron uprights, a copper hydraulic ram, a gear on an anvil, calibration wheel and teal dial. | exec-3fe60d60-8e08-4d25-ad28-200899f0ef6b.png |
| hand-crank.png | A curved brass crank with a wooden handle, compact copper gearbox and exposed gear. | exec-d8d839a3-8cf8-40e6-8731-7c411794425d.png |

The Clockwork browser uses these illustrations by definition ID without modifying the rules catalogue or replay hash. Commission line drawings are original inline SVG geometry in `apps/web/src/App.tsx`. Names, costs, readiness, and rules remain live text and icons.
