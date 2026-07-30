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
import { AccountCategoriesService } from './account-categories.service';
import { CreateAccountCategoryDto } from './dto/create-account-category.dto';
import { UpdateAccountCategoryDto } from './dto/update-account-category.dto';
import { AccountCategoriesPaginationDto } from './dto/pagination.dto';
import { UserRoleGuard } from 'src/auth/guards/user-role/user-role.guard';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Account Categories')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
@Controller('account-categories')
export class AccountCategoriesController {
  constructor(
    private readonly accountCategoriesService: AccountCategoriesService,
  ) {}

  @Post()
  @RequirePermissions('CREATE_ACCOUNT_CATEGORIES')
  create(
    @Body() createAccountCategoryDto: CreateAccountCategoryDto,
    @Req() req: any,
  ) {
    return this.accountCategoriesService.create(createAccountCategoryDto, req.user?.id);
  }

  @Get()
  @RequirePermissions('READ_ACCOUNT_CATEGORIES')
  findAll(@Query() paginationDto: AccountCategoriesPaginationDto) {
    return this.accountCategoriesService.findAll(paginationDto);
  }

  @Get(':id')
  @RequirePermissions('READ_ACCOUNT_CATEGORIES')
  findOne(@Param('id') id: string) {
    return this.accountCategoriesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('UPDATE_ACCOUNT_CATEGORIES')
  update(
    @Param('id') id: string,
    @Body() updateAccountCategoryDto: UpdateAccountCategoryDto,
    @Req() req: any,
  ) {
    return this.accountCategoriesService.update(
      id,
      updateAccountCategoryDto,
      req.user?.id,
    );
  }

  @Delete(':id')
  @RequirePermissions('DELETE_ACCOUNT_CATEGORIES')
  remove(@Param('id') id: string) {
    return this.accountCategoriesService.remove(id);
  }
}
