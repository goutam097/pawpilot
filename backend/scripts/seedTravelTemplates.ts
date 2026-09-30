/**
 * Seed travel templates.
 *
 * Run manually (or as part of a deploy) to insert/update templates in Mongo.
 *
 * Usage:
 *   npx tsx scripts/seedTravelTemplates.ts
 *
 * Idempotent: upserts by tripType. Bumps `version` when items change.
 *
 * Why not auto-seed at server startup?
 * - Auto-migrations/seeders are a footgun in production. A backend restart
 *   should not modify data.
 * - Content changes should be reviewed and deployed explicitly.
 * - If templates are missing, the app fails gracefully (plans still work;
 *   just no starter items).
 */
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { TravelTemplateModel, TRIP_TYPES, type TripType } from '../src/models/TravelTemplate.js';

interface TemplateSeed {
  tripType: TripType;
  name: string;
  description: string;
  items: { label: string; description?: string }[];
}

/**
 * IMPORTANT: These are NOT authoritative. They are common items that
 * typically apply to these trip types. Always verify with your airline,
 * destination country, and vet.
 *
 * We use words like "typical" and "common" and avoid "required" or "must".
 */
const TEMPLATES: TemplateSeed[] = [
  {
    tripType: 'domestic_flight',
    name: 'Domestic flight',
    description:
      'Typical items for a domestic flight. Always verify with your airline and destination.',
    items: [
      { label: 'Airline-approved pet carrier', description: 'Check your airline\'s carrier size and type requirements.' },
      { label: 'Health certificate', description: 'Some airlines require one issued within 10 days of travel.' },
      { label: 'Vaccination records', description: 'Proof of current rabies and other vaccinations.' },
      { label: 'Leash and collar with ID tag' },
      { label: 'Food and water bowls (collapsible)' },
      { label: 'Food for the trip' },
      { label: 'Waste bags' },
      { label: 'Medications', description: 'With dosage and instructions.' },
      { label: 'Comfort item (toy or blanket)' },
    ],
  },
  {
    tripType: 'international_flight',
    name: 'International flight',
    description:
      'Common items for international travel. Requirements vary significantly by country — verify with the destination\'s embassy or consulate.',
    items: [
      { label: 'International health certificate', description: 'Often must be endorsed by a government veterinarian.' },
      { label: 'Rabies titer test (FAVN)', description: 'Some countries require this months before travel.' },
      { label: 'ISO-compliant microchip', description: 'Must be implanted before rabies vaccination for many destinations.' },
      { label: 'Import permit', description: 'Some countries require an advance permit.' },
      { label: 'Customs documentation' },
      { label: 'Airline-approved carrier' },
      { label: 'Vaccination records (originals)', description: 'Copies are sometimes not accepted.' },
      { label: 'Leash and collar with ID tag' },
      { label: 'Food and water for the journey' },
      { label: 'Medications with documentation' },
      { label: 'Waste bags' },
    ],
  },
  {
    tripType: 'road_trip',
    name: 'Road trip',
    description: 'Typical items for a road trip with your pet.',
    items: [
      { label: 'Leash and collar with ID tag' },
      { label: 'Crate or travel carrier' },
      { label: 'Food and water bowls' },
      { label: 'Food for the trip' },
      { label: 'Water bottle (for refills)' },
      { label: 'Waste bags' },
      { label: 'Medications' },
      { label: 'Vaccination records' },
      { label: 'Favorite toy or blanket' },
      { label: 'First aid kit' },
      { label: 'Recent photo (in case of emergency)' },
    ],
  },
  {
    tripType: 'boarding',
    name: 'Boarding',
    description: 'Typical items for boarding your pet.',
    items: [
      { label: 'Vaccination records', description: 'Most boarding facilities require proof.' },
      { label: 'Medications with instructions' },
      { label: 'Food (enough for the stay)', description: 'Some pets do better on their regular food.' },
      { label: 'Feeding instructions' },
      { label: 'Leash and collar with ID tag' },
      { label: 'Favorite toy or blanket' },
      { label: 'Emergency contact info' },
      { label: 'Vet contact info' },
    ],
  },
];

async function seed(): Promise<void> {
  console.log(
    JSON.stringify({ level: 'info', msg: 'seeding travel templates', count: TEMPLATES.length }),
  );

  await mongoose.connect(env.mongodbUri);

  try {
    for (const template of TEMPLATES) {
      const existing = await TravelTemplateModel.findOne({ tripType: template.tripType });

      // Determine whether items changed. If the same labels are present,
      // no version bump.
      const itemsChanged =
        !existing ||
        existing.items.length !== template.items.length ||
        existing.items.some((item, i) => item.label !== template.items[i]?.label);

      const itemsWithOrder = template.items.map((item, index) => ({
        label: item.label,
        description: item.description ?? null,
        order: index,
      }));

      /* if (existing) {
        await TravelTemplateModel.updateOne(
          { tripType: template.tripType },
          {
            $set: {
              name: template.name,
              description: template.description,
              items: itemsWithOrder,
              ...(itemsChanged ? { $inc: { version: 1 } } : {}),
            },
          },
        );
        console.log(
          JSON.stringify({
            level: 'info',
            msg: 'template updated',
            tripType: template.tripType,
            itemsChanged,
          }),
        );
      } */
         if (existing) {
        const update: Record<string, unknown> = {
          name: template.name,
          description: template.description,
          items: itemsWithOrder,
        };

        if (itemsChanged) {
          update.version = existing.version + 1;
        }

        await TravelTemplateModel.updateOne(
          { tripType: template.tripType },
          { $set: update },
        );
      }       else {
        await TravelTemplateModel.create({
          tripType: template.tripType,
          name: template.name,
          description: template.description,
          items: itemsWithOrder,
          version: 1,
        });
        console.log(
          JSON.stringify({
            level: 'info',
            msg: 'template created',
            tripType: template.tripType,
          }),
        );
      }
    }

    console.log(
      JSON.stringify({ level: 'info', msg: 'templates seeded', tripTypes: TRIP_TYPES }),
    );
  } finally {
    await mongoose.disconnect();
  }
}

seed().catch((err) => {
  console.error(
    JSON.stringify({
      level: 'error',
      msg: 'seed failed',
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exit(1);
});