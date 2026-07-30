import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AccountChargesService } from './account-charges.service';
import { CreateAccountChargeDto } from './dto/create-account-charge.dto';
import { UpdateAccountChargeDto } from './dto/update-account-charge.dto';
import { AccountChargesPaginationDto } from './dto/pagination.dto';
import { UserRoleGuard } from 'src/auth/guards/user-role/user-role.guard';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Account Charges')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
@Controller('account-charges')
export class AccountChargesController {
  constructor(private readonly accountChargesService: AccountChargesService) {}

  @Post()
  @RequirePermissions('CREATE_ACCOUNT_CHARGES')
  create(
    @Body() createAccountChargeDto: CreateAccountChargeDto,
    @Req() req: any,
  ) {
    return this.accountChargesService.create(createAccountChargeDto, req.user?.id);
  }

  @Get()
  @RequirePermissions('READ_ACCOUNT_CHARGES')
  findAll(@Query() paginationDto: AccountChargesPaginationDto) {
    return this.accountChargesService.findAll(paginationDto);
  }




  @Get(':id')
  @RequirePermissions('READ_ACCOUNT_CHARGES')
  findOne(@Param('id') id: string) {
    return this.accountChargesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('UPDATE_ACCOUNT_CHARGES')
  update(
    @Param('id') id: string,
    @Body() updateAccountChargeDto: UpdateAccountChargeDto,
    @Req() req: any,
  ) {
    return this.accountChargesService.update(id, updateAccountChargeDto, req.user?.id);
  }

  @Delete(':id')
  @RequirePermissions('DELETE_ACCOUNT_CHARGES')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.accountChargesService.remove(id, req.user?.id);
  }
}
