import { Injectable } from '@nestjs/common';
import { CreateMatchDetailDto } from './dto/create-match-detail.dto';
import { UpdateMatchDetailDto } from './dto/update-match-detail.dto';

@Injectable()
export class MatchDetailService {
  create(createMatchDetailDto: CreateMatchDetailDto) {
    return 'This action adds a new matchDetail';
  }

  findAll() {
    return `This action returns all matchDetail`;
  }

  findOne(id: number) {
    return `This action returns a #${id} matchDetail`;
  }

  update(id: number, updateMatchDetailDto: UpdateMatchDetailDto) {
    return `This action updates a #${id} matchDetail`;
  }

  remove(id: number) {
    return `This action removes a #${id} matchDetail`;
  }
}
