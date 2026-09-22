const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// 1. Remove old MatchLineup entirely
const matchLineupRegex = /model MatchLineup \{[\s\S]*?@@map\("match_lineups"\)\n\}\n/;
schema = schema.replace(matchLineupRegex, '');

// 2. Add MatchSide enum and the new MatchCallUp and MatchLineup models to the end of the file
const newModels = `
enum MatchSide {
  HOME
  AWAY
}

model MatchCallUp {
  id          String       @id @default(uuid())
  matchId     String       @map("match_id")
  playerId    String       @map("player_id")
  side        MatchSide
  isGuest     Boolean      @default(false) @map("is_guest")
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")
  createdById String?      @map("created_by_id")
  updatedById String?      @map("updated_by_id")
  createdBy   User?        @relation("CreatedBy", fields: [createdById], references: [id])
  updatedBy   User?        @relation("UpdatedBy", fields: [updatedById], references: [id])
  match       Match        @relation(fields: [matchId], references: [id], onDelete: Cascade)
  player      Player       @relation(fields: [playerId], references: [id], onDelete: Restrict)
  lineup      MatchLineup?

  @@unique([matchId, playerId])
  @@index([matchId, side])
  @@map("match_call_ups")
}

model MatchLineup {
  id            String      @id @default(uuid())
  callUpId      String      @unique @map("call_up_id")
  minutesPlayed Int         @default(0) @map("minutes_played")
  goals         Int         @default(0)
  assists       Int         @default(0)
  yellowCards   Int         @default(0) @map("yellow_cards")
  redCards      Int         @default(0) @map("red_cards")
  isStarter     Boolean     @default(false) @map("is_starter")
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")
  createdById   String?     @map("created_by_id")
  updatedById   String?     @map("updated_by_id")
  createdBy     User?       @relation("CreatedBy", fields: [createdById], references: [id])
  updatedBy     User?       @relation("UpdatedBy", fields: [updatedById], references: [id])
  callUp        MatchCallUp @relation(fields: [callUpId], references: [id], onDelete: Cascade)

  @@map("match_lineups")
}
`;
schema += newModels;

// 3. Update Match model
const matchTarget = `model Match {
  id                   String             @id @default(uuid())
  eventId              String             @unique @map("event_id")
  type                 MatchType          @default(LEAGUE)
  result               MatchResult        @default(PENDING)
  awayScore            Int?               @map("away_score")
  awayTeamId           String             @map("away_team_id")
  homeScore            Int?               @map("home_score")
  homeTeamId           String             @map("home_team_id")
  teamSeasonCategoryId String             @map("team_season_category_id")
  lineups              MatchLineup[]
  awayTeam             Team               @relation("MatchAwayTeam", fields: [awayTeamId], references: [id])
  event                Event              @relation(fields: [eventId], references: [id], onDelete: Cascade)
  homeTeam             Team               @relation("MatchHomeTeam", fields: [homeTeamId], references: [id])
  teamSeasonCategory   TeamSeasonCategory @relation(fields: [teamSeasonCategoryId], references: [id])

  @@map("matches")
}`;

const matchReplacement = `model Match {
  id                       String              @id @default(uuid())
  eventId                  String              @unique @map("event_id")
  type                     MatchType           @default(LEAGUE)
  result                   MatchResult         @default(PENDING)
  awayScore                Int?                @map("away_score")
  awayTeamId               String              @map("away_team_id")
  homeScore                Int?                @map("home_score")
  homeTeamId               String              @map("home_team_id")
  teamSeasonCategoryId     String?             @map("team_season_category_id")
  homeTeamSeasonCategoryId String?             @map("home_team_season_category_id")
  awayTeamSeasonCategoryId String?             @map("away_team_season_category_id")
  homeCoachId              String?             @map("home_coach_id")
  awayCoachId              String?             @map("away_coach_id")
  callUps                  MatchCallUp[]
  awayTeam                 Team                @relation("MatchAwayTeam", fields: [awayTeamId], references: [id])
  event                    Event               @relation(fields: [eventId], references: [id], onDelete: Cascade)
  homeTeam                 Team                @relation("MatchHomeTeam", fields: [homeTeamId], references: [id])
  teamSeasonCategory       TeamSeasonCategory? @relation("MatchLegacyCategory", fields: [teamSeasonCategoryId], references: [id])
  homeTeamSeasonCategory   TeamSeasonCategory? @relation("MatchHomeCategory", fields: [homeTeamSeasonCategoryId], references: [id])
  awayTeamSeasonCategory   TeamSeasonCategory? @relation("MatchAwayCategory", fields: [awayTeamSeasonCategoryId], references: [id])
  homeCoach                User?               @relation("MatchHomeCoach", fields: [homeCoachId], references: [id])
  awayCoach                User?               @relation("MatchAwayCoach", fields: [awayCoachId], references: [id])

  @@map("matches")
}`;
schema = schema.replace(matchTarget, matchReplacement);

// 4. Update TeamSeasonCategory
const tscTarget = `  matches           Match[]`;
const tscReplacement = `  legacyMatches     Match[]                  @relation("MatchLegacyCategory")\n  homeMatches       Match[]                  @relation("MatchHomeCategory")\n  awayMatches       Match[]                  @relation("MatchAwayCategory")`;
schema = schema.replace(tscTarget, tscReplacement);

// 5. Update User
const userTarget = `  updatedBy         User?`;
const userReplacement = `  updatedBy         User?\n  homeMatchesCoached       Match[]             @relation("MatchHomeCoach")\n  awayMatchesCoached       Match[]             @relation("MatchAwayCoach")\n  createdMatchCallUps      MatchCallUp[]       @relation("CreatedBy")\n  updatedMatchCallUps      MatchCallUp[]       @relation("UpdatedBy")`;
schema = schema.replace(userTarget, userReplacement);

fs.writeFileSync(schemaPath, schema);
console.log("Schema perfectly restored.");
