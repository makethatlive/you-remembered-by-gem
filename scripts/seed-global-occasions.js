/**
 * Seed script for Global Occasion Dates
 * Populates the database with initial dates for variable occasions (Eid, Diwali, etc.)
 * 
 * Usage: node scripts/seed-global-occasions.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OCCASIONS = [
  // Christmas (Fixed - December 25)
  { occasionType: 'Christmas', year: 2026, month: 12, day: 25, notes: 'Christmas Day 2026' },
  { occasionType: 'Christmas', year: 2027, month: 12, day: 25, notes: 'Christmas Day 2027' },
  { occasionType: 'Christmas', year: 2028, month: 12, day: 25, notes: 'Christmas Day 2028' },
  { occasionType: 'Christmas', year: 2029, month: 12, day: 25, notes: 'Christmas Day 2029' },
  
  // Mother's Day (UK - 4th Sunday of Lent, 3 weeks before Easter)
  { occasionType: "Mother's Day", year: 2027, month: 3, day: 14, notes: "UK Mother's Day 2027 (Mothering Sunday)" },
  { occasionType: "Mother's Day", year: 2028, month: 3, day: 26, notes: "UK Mother's Day 2028 (Mothering Sunday)" },
  { occasionType: "Mother's Day", year: 2029, month: 3, day: 11, notes: "UK Mother's Day 2029 (Mothering Sunday)" },
  { occasionType: "Mother's Day", year: 2030, month: 3, day: 31, notes: "UK Mother's Day 2030 (Mothering Sunday)" },
  
  // Father's Day (UK - 3rd Sunday of June)
  { occasionType: "Father's Day", year: 2027, month: 6, day: 20, notes: "UK Father's Day 2027" },
  { occasionType: "Father's Day", year: 2028, month: 6, day: 18, notes: "UK Father's Day 2028" },
  { occasionType: "Father's Day", year: 2029, month: 6, day: 17, notes: "UK Father's Day 2029" },
  { occasionType: "Father's Day", year: 2030, month: 6, day: 16, notes: "UK Father's Day 2030" },
  
  // Easter Sunday (Varies - calculated date)
  { occasionType: 'Easter', year: 2027, month: 3, day: 28, notes: 'Easter Sunday 2027' },
  { occasionType: 'Easter', year: 2028, month: 4, day: 16, notes: 'Easter Sunday 2028' },
  { occasionType: 'Easter', year: 2029, month: 4, day: 1, notes: 'Easter Sunday 2029' },
  { occasionType: 'Easter', year: 2030, month: 4, day: 21, notes: 'Easter Sunday 2030' },
  
  // Eid al-Fitr (estimated - based on lunar calendar, moon sighting dependent)
  { occasionType: 'Eid', year: 2026, month: 4, day: 1, notes: 'Eid al-Fitr 2026 (estimated - moon sighting dependent)' },
  { occasionType: 'Eid', year: 2027, month: 3, day: 21, notes: 'Eid al-Fitr 2027 (estimated - moon sighting dependent)' },
  { occasionType: 'Eid', year: 2028, month: 3, day: 10, notes: 'Eid al-Fitr 2028 (estimated - moon sighting dependent)' },
  { occasionType: 'Eid', year: 2029, month: 2, day: 27, notes: 'Eid al-Fitr 2029 (estimated - moon sighting dependent)' },
  { occasionType: 'Eid', year: 2030, month: 2, day: 16, notes: 'Eid al-Fitr 2030 (estimated - moon sighting dependent)' },
  
  // Diwali (Hindu Festival of Lights - varies by lunar calendar)
  { occasionType: 'Diwali', year: 2026, month: 11, day: 8, notes: 'Diwali 2026' },
  { occasionType: 'Diwali', year: 2027, month: 10, day: 29, notes: 'Diwali 2027' },
  { occasionType: 'Diwali', year: 2028, month: 10, day: 17, notes: 'Diwali 2028' },
  { occasionType: 'Diwali', year: 2029, month: 11, day: 5, notes: 'Diwali 2029' },
  { occasionType: 'Diwali', year: 2030, month: 10, day: 26, notes: 'Diwali 2030' },
  
  // Hanukkah (Jewish Festival of Lights - 1st night, 8 days total)
  { occasionType: 'Hanukkah', year: 2026, month: 12, day: 5, notes: 'Hanukkah 2026 (1st night)' },
  { occasionType: 'Hanukkah', year: 2027, month: 12, day: 25, notes: 'Hanukkah 2027 (1st night)' },
  { occasionType: 'Hanukkah', year: 2028, month: 12, day: 13, notes: 'Hanukkah 2028 (1st night)' },
  { occasionType: 'Hanukkah', year: 2029, month: 12, day: 2, notes: 'Hanukkah 2029 (1st night)' },
  { occasionType: 'Hanukkah', year: 2030, month: 12, day: 22, notes: 'Hanukkah 2030 (1st night)' },
  
  // Rosh Hashanah (Jewish New Year - 2 days)
  { occasionType: 'Rosh Hashanah', year: 2026, month: 9, day: 12, notes: 'Rosh Hashanah 2026 (Jewish New Year 5787)' },
  { occasionType: 'Rosh Hashanah', year: 2027, month: 10, day: 2, notes: 'Rosh Hashanah 2027 (Jewish New Year 5788)' },
  { occasionType: 'Rosh Hashanah', year: 2028, month: 9, day: 21, notes: 'Rosh Hashanah 2028 (Jewish New Year 5789)' },
  { occasionType: 'Rosh Hashanah', year: 2029, month: 9, day: 10, notes: 'Rosh Hashanah 2029 (Jewish New Year 5790)' },
  { occasionType: 'Rosh Hashanah', year: 2030, month: 9, day: 28, notes: 'Rosh Hashanah 2030 (Jewish New Year 5791)' },
  
  // Lunar New Year (Chinese New Year / Spring Festival)
  { occasionType: 'Lunar New Year', year: 2027, month: 2, day: 6, notes: 'Lunar New Year 2027 (Year of the Goat)' },
  { occasionType: 'Lunar New Year', year: 2028, month: 1, day: 26, notes: 'Lunar New Year 2028 (Year of the Monkey)' },
  { occasionType: 'Lunar New Year', year: 2029, month: 2, day: 13, notes: 'Lunar New Year 2029 (Year of the Rooster)' },
  { occasionType: 'Lunar New Year', year: 2030, month: 2, day: 3, notes: 'Lunar New Year 2030 (Year of the Dog)' },
  { occasionType: 'Lunar New Year', year: 2031, month: 1, day: 23, notes: 'Lunar New Year 2031 (Year of the Pig)' },
];

async function seed() {
  try {
    console.log('🌍 Seeding global occasion dates...\n');

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const occasion of OCCASIONS) {
      const existing = await prisma.globalOccasionDate.findUnique({
        where: {
          occasionType_year: {
            occasionType: occasion.occasionType,
            year: occasion.year
          }
        }
      });

      if (existing) {
        // Check if data is different
        if (
          existing.month === occasion.month &&
          existing.day === occasion.day &&
          existing.notes === occasion.notes
        ) {
          console.log(`⏭️  Skipped: ${occasion.occasionType} ${occasion.year} (already exists)`);
          skipped++;
        } else {
          await prisma.globalOccasionDate.update({
            where: { id: existing.id },
            data: {
              month: occasion.month,
              day: occasion.day,
              notes: occasion.notes
            }
          });
          console.log(`✏️  Updated: ${occasion.occasionType} ${occasion.year} → ${occasion.month}/${occasion.day}`);
          updated++;
        }
      } else {
        await prisma.globalOccasionDate.create({
          data: occasion
        });
        console.log(`✅ Created: ${occasion.occasionType} ${occasion.year} → ${occasion.month}/${occasion.day}`);
        created++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total:   ${OCCASIONS.length}`);
    console.log('\n✨ Seeding complete!');

  } catch (error) {
    console.error('❌ Error seeding occasions:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
