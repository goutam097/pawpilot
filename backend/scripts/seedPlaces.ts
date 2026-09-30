/**
 * Seed sample places.
 *
 * IMPORTANT: These are STARTER DATA for MVP. In a production app, places
 * would come from a real data source (Google Places, Yelp, OpenStreetMap).
 * This dataset exists to prove the feature works end to end.
 *
 * The mobile app labels this data honestly: "Showing a sample of places.
 * Real local listings coming soon."
 */
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { PlaceModel, type PlaceType } from '../src/models/Place.js';

interface PlaceSeed {
  externalId: string;
  name: string;
  type: PlaceType;
  lat: number;
  lng: number;
  address?: string;
  city: string;
  region: string;
  postalCode?: string;
  phone?: string;
  website?: string;
  description?: string;
  hours?: {
    [day: string]: { open: string; close: string } | null;
  };
}

const STANDARD_HOURS = {
  monday: { open: '09:00', close: '18:00' },
  tuesday: { open: '09:00', close: '18:00' },
  wednesday: { open: '09:00', close: '18:00' },
  thursday: { open: '09:00', close: '18:00' },
  friday: { open: '09:00', close: '18:00' },
  saturday: { open: '10:00', close: '16:00' },
  sunday: null,
};

const PARK_HOURS = {
  monday: { open: '06:00', close: '22:00' },
  tuesday: { open: '06:00', close: '22:00' },
  wednesday: { open: '06:00', close: '22:00' },
  thursday: { open: '06:00', close: '22:00' },
  friday: { open: '06:00', close: '22:00' },
  saturday: { open: '06:00', close: '22:00' },
  sunday: { open: '06:00', close: '22:00' },
};

const PLACES: PlaceSeed[] = [
  // Austin
  {
    externalId: 'sample-austin-vet-1',
    name: 'Zilker Animal Hospital',
    type: 'veterinarian',
    lat: 30.2597,
    lng: -97.7697,
    address: '1901 Bluebonnet Ln',
    city: 'Austin',
    region: 'TX',
    postalCode: '78704',
    phone: '(512) 555-0100',
    description: 'Full-service veterinary care. Walk-ins welcome.',
    hours: STANDARD_HOURS,
  },
  {
    externalId: 'sample-austin-park-1',
    name: 'Zilker Metropolitan Park',
    type: 'dog_park',
    lat: 30.2669,
    lng: -97.7729,
    address: '2100 Barton Springs Rd',
    city: 'Austin',
    region: 'TX',
    postalCode: '78704',
    description: 'Off-leash area with water fountains for dogs.',
    hours: PARK_HOURS,
  },
  {
    externalId: 'sample-austin-groomer-1',
    name: 'Bluebonnet Pet Spa',
    type: 'groomer',
    lat: 30.2571,
    lng: -97.7431,
    address: '1200 E 6th St',
    city: 'Austin',
    region: 'TX',
    postalCode: '78702',
    description: 'Full-service grooming for dogs and cats.',
    hours: STANDARD_HOURS,
  },

  // San Francisco
  {
    externalId: 'sample-sf-vet-1',
    name: 'Mission Pet Hospital',
    type: 'veterinarian',
    lat: 37.7603,
    lng: -122.4183,
    address: '720 Valencia St',
    city: 'San Francisco',
    region: 'CA',
    postalCode: '94110',
    phone: '(415) 555-0200',
    description: 'Neighborhood vet practice. Emergency appointments available.',
    hours: STANDARD_HOURS,
  },
  {
    externalId: 'sample-sf-park-1',
    name: 'Duboce Park',
    type: 'dog_park',
    lat: 37.7697,
    lng: -122.4322,
    address: 'Duboce Ave & Scott St',
    city: 'San Francisco',
    region: 'CA',
    postalCode: '94117',
    description: 'Popular off-leash dog park. Fenced.',
    hours: PARK_HOURS,
  },
  {
    externalId: 'sample-sf-store-1',
    name: 'Pet Food Express',
    type: 'pet_store',
    lat: 37.7632,
    lng: -122.4208,
    address: '2175 Market St',
    city: 'San Francisco',
    region: 'CA',
    postalCode: '94114',
    description: 'Independent pet food store with self-service dog wash.',
    hours: STANDARD_HOURS,
  },

  // New York
  {
    externalId: 'sample-nyc-vet-1',
    name: 'West Village Veterinary',
    type: 'veterinarian',
    lat: 40.7359,
    lng: -74.0036,
    address: '2 Greenwich Ave',
    city: 'New York',
    region: 'NY',
    postalCode: '10014',
    description: 'Veterinary care for dogs and cats.',
    hours: STANDARD_HOURS,
  },
  {
    externalId: 'sample-nyc-park-1',
    name: 'Washington Square Park Dog Run',
    type: 'dog_park',
    lat: 40.7306,
    lng: -73.9978,
    address: 'Washington Square Park',
    city: 'New York',
    region: 'NY',
    postalCode: '10012',
    description: 'Two separate runs for small and large dogs.',
    hours: PARK_HOURS,
  },
  {
    externalId: 'sample-nyc-restaurant-1',
    name: 'The Grey Dog',
    type: 'pet_friendly_restaurant',
    lat: 40.7303,
    lng: -74.0019,
    address: '90 University Pl',
    city: 'New York',
    region: 'NY',
    postalCode: '10003',
    description: 'Casual cafe with outdoor seating. Dogs welcome.',
    hours: {
      monday: { open: '07:30', close: '22:00' },
      tuesday: { open: '07:30', close: '22:00' },
      wednesday: { open: '07:30', close: '22:00' },
      thursday: { open: '07:30', close: '22:00' },
      friday: { open: '07:30', close: '23:00' },
      saturday: { open: '08:00', close: '23:00' },
      sunday: { open: '08:00', close: '22:00' },
    },
  },
];

async function seed(): Promise<void> {
  console.log(
    JSON.stringify({ level: 'info', msg: 'seeding places', count: PLACES.length }),
  );

  await mongoose.connect(env.mongodbUri);

  try {
    let created = 0;
    let updated = 0;

    for (const place of PLACES) {
      const existing = await PlaceModel.findOne({ externalId: place.externalId });

      const data = {
        externalId: place.externalId,
        name: place.name,
        type: place.type,
        location: {
          type: 'Point' as const,
          coordinates: [place.lng, place.lat], // [lng, lat]!
        },
        address: place.address ?? null,
        city: place.city,
        region: place.region,
        postalCode: place.postalCode ?? null,
        phone: place.phone ?? null,
        website: place.website ?? null,
        hours: place.hours ?? {},
        description: place.description ?? null,
      };

      if (existing) {
        // Only update fields, don't touch review aggregate.
        await PlaceModel.updateOne({ externalId: place.externalId }, { $set: data });
        updated += 1;
      } else {
        await PlaceModel.create(data);
        created += 1;
      }
    }

    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'places seeded',
        created,
        updated,
      }),
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