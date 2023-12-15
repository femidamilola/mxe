import { Controller, Get, Query, Req } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from './dto/pagination.dto';

@ApiTags('Wallet')
@Controller('wallet')
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get('transactions')
  @ApiOperation({ summary: "Get all a wallet's transcations" })
  getWalletTransactions(@Query() dto: PaginationDto, @Req() req) {
    return this.walletService.getWalletTransactions(req.user.email, dto);
  }

  @Get('details')
  @ApiOperation({ summary: "Get all a wallet's transcations" })
  getWalletDetails(@Req() req) {
    return this.walletService.getWalletDetails(req.user.email);
  }
}