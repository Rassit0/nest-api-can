import { validate } from 'class-validator';
import { MatchLineupEntryDto, UpdateMatchLineupBulkDto } from './src/match-lineups/dto/update-match-lineup-bulk.dto';

async function run() {
  const dto = new UpdateMatchLineupBulkDto();
  const entry = new MatchLineupEntryDto();
  entry.callUpId = '123e4567-e89b-12d3-a456-426614174000';
  entry.isStarter = true;
  entry.minutesPlayed = 90;
  entry.goals = 1;
  entry.assists = 0;
  entry.yellowCards = 0;
  entry.redCards = 0;
  dto.lineups = [entry];
  const errors = await validate(dto);
  console.log(JSON.stringify(errors, null, 2));
}
run();
