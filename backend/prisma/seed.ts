import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const data = [
  {
    state: 'Abuja (FCT)',
    lgas: [
      { name: 'Municipal Area Council', wards: ['Garki', 'Wuse', 'Maitama', 'Asokoro', 'Gwarinpa'] },
      { name: 'Bwari', wards: ['Bwari Central', 'Ushafa', 'Dutse', 'Igu'] },
      { name: 'Gwagwalada', wards: ['Gwagwalada Central', 'Dobi', 'Ikwa', 'Zuba'] },
    ],
  },
  {
    state: 'Lagos',
    lgas: [
      { name: 'Ikeja', wards: ['Alausa', 'Agidingbi', 'Oregun', 'Ojodu', 'Onigbongbo'] },
      { name: 'Eti-Osa', wards: ['Lekki Phase 1', 'Victoria Island', 'Ikoyi', 'Ajah'] },
      { name: 'Surulere', wards: ['Aguda', 'Itire', 'Bode Thomas', 'Ijeshatedo'] },
    ],
  },
  {
    state: 'Kano',
    lgas: [
      { name: 'Kano Municipal', wards: ['Fagge', 'Gwale', 'Kano Central', 'Dala'] },
      { name: 'Nassarawa', wards: ['Nassarawa Central', 'Tudun Wada', 'Kofar Ruwa'] },
    ],
  },
  {
    state: 'Rivers',
    lgas: [
      { name: 'Port Harcourt', wards: ['D-Line', 'GRA Phase 1', 'Rumuola', 'Diobu'] },
      { name: 'Obio-Akpor', wards: ['Rumuigbo', 'Ozuoba', 'Rumuola'] },
    ],
  },
  {
    state: 'Oyo',
    lgas: [
      { name: 'Ibadan North', wards: ['Agodi', 'Bodija', 'Sango', 'Yemetu'] },
      { name: 'Ibadan South-West', wards: ['Oke-Ado', 'Iyaganku', 'Oluyole'] },
    ],
  },
];

async function main() {
  console.log('Seeding geo data...');
  for (const entry of data) {
    const state = await prisma.state.upsert({
      where: { name: entry.state },
      update: {},
      create: { name: entry.state },
    });
    for (const lgaEntry of entry.lgas) {
      const lga = await prisma.lga.upsert({
        where: { name_stateId: { name: lgaEntry.name, stateId: state.id } },
        update: {},
        create: { name: lgaEntry.name, stateId: state.id },
      });
      for (const wardName of lgaEntry.wards) {
        await prisma.ward.upsert({
          where: { name_lgaId: { name: wardName, lgaId: lga.id } },
          update: {},
          create: { name: wardName, lgaId: lga.id },
        });
      }
    }
  }

  const adminHash = await bcrypt.hash('Admin@1234', 10);
  await prisma.user.upsert({
    where: { email: 'admin@nimc.gov.ng' },
    update: {},
    create: { email: 'admin@nimc.gov.ng', passwordHash: adminHash, name: 'NIMC Admin', role: 'ADMIN' },
  });
  console.log('Done. Admin: admin@nimc.gov.ng / Admin@1234');
}

main().catch(console.error).finally(() => prisma.$disconnect());
