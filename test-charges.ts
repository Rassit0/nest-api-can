import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { MembershipChargesService } from './src/membership-charges/membership-charges.service';
import { PrismaService } from './src/prisma.service';
import { Prisma } from './src/generated/prisma/client';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(MembershipChargesService);
  const prisma = app.get(PrismaService);

  const teamSeason = await prisma.teamSeason.findFirst({ include: { season: true } });
  const paymentPlan = await prisma.paymentPlan.findFirst();

  if (teamSeason && paymentPlan) {
    console.log("Simulando para TeamSeason: ", teamSeason.id);
    console.log("Simulando para PaymentPlan: ", paymentPlan.id);
    
    // Simulate advance cycles and free cycles on the plan for testing
    paymentPlan.advanceCycles = 3;
    paymentPlan.advanceCyclesDiscountPercent = new Prisma.Decimal(100);
    
    try {
        const result = await service.previewCharges({
            teamSeasonId: teamSeason.id,
            paymentPlanId: paymentPlan.id,
            startDate: teamSeason.season.startDate.toISOString(),
        });
        
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error(e);
    }
  } else {
    console.log("No hay TeamSeason o PaymentPlan en la DB");
  }

  await app.close();
}
bootstrap();
