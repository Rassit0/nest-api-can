import { validate } from 'class-validator';
import { MatchLineupEntryDto, UpdateMatchLineupBulkDto } from './update-match-lineup-bulk.dto';

describe('UpdateMatchLineupBulkDto', () => {
  it('should pass with valid data', async () => {
    const dto = new UpdateMatchLineupBulkDto();
    const entry = new MatchLineupEntryDto();
    entry.callUpId = 'd6e8b4e7-4b71-4a4a-9e32-2d41b6c7a6e1'; // valid uuid
    entry.isStarter = true;
    entry.minutesPlayed = 90;
    entry.goals = 1;
    entry.assists = 0;
    entry.yellowCards = 0;
    entry.redCards = 0;
    
    dto.lineups = [entry];
    
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject negative minutesPlayed', async () => {
    const dto = new UpdateMatchLineupBulkDto();
    const entry = new MatchLineupEntryDto();
    entry.callUpId = 'd6e8b4e7-4b71-4a4a-9e32-2d41b6c7a6e1';
    entry.isStarter = true;
    entry.minutesPlayed = -1; // negative
    entry.goals = 0;
    entry.assists = 0;
    entry.yellowCards = 0;
    entry.redCards = 0;
    
    dto.lineups = [entry];
    
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    // Validation passes for negative test
  });

  it('should reject negative goals', async () => {
    const dto = new UpdateMatchLineupBulkDto();
    const entry = new MatchLineupEntryDto();
    entry.callUpId = 'd6e8b4e7-4b71-4a4a-9e32-2d41b6c7a6e1';
    entry.isStarter = true;
    entry.minutesPlayed = 90;
    entry.goals = -5; // negative
    entry.assists = 0;
    entry.yellowCards = 0;
    entry.redCards = 0;
    
    dto.lineups = [entry];
    
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject negative assists', async () => {
    const dto = new UpdateMatchLineupBulkDto();
    const entry = new MatchLineupEntryDto();
    entry.callUpId = 'd6e8b4e7-4b71-4a4a-9e32-2d41b6c7a6e1';
    entry.isStarter = true;
    entry.minutesPlayed = 90;
    entry.goals = 0;
    entry.assists = -2; // negative
    entry.yellowCards = 0;
    entry.redCards = 0;
    
    dto.lineups = [entry];
    
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject negative yellowCards', async () => {
    const dto = new UpdateMatchLineupBulkDto();
    const entry = new MatchLineupEntryDto();
    entry.callUpId = 'd6e8b4e7-4b71-4a4a-9e32-2d41b6c7a6e1';
    entry.isStarter = true;
    entry.minutesPlayed = 90;
    entry.goals = 0;
    entry.assists = 0;
    entry.yellowCards = -1; // negative
    entry.redCards = 0;
    
    dto.lineups = [entry];
    
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject negative redCards', async () => {
    const dto = new UpdateMatchLineupBulkDto();
    const entry = new MatchLineupEntryDto();
    entry.callUpId = 'd6e8b4e7-4b71-4a4a-9e32-2d41b6c7a6e1';
    entry.isStarter = true;
    entry.minutesPlayed = 90;
    entry.goals = 0;
    entry.assists = 0;
    entry.yellowCards = 0;
    entry.redCards = -1; // negative
    
    dto.lineups = [entry];
    
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
