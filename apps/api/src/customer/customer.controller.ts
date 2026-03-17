import { Controller, Post, Get, Patch, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomerService } from './customer.service';
import { RegisterDto, LoginDto, ChangePasswordDto, UpdateProfileDto } from './dto/customer.dto';

@ApiTags('Customer Auth')
@Controller('customer')
export class CustomerController {
  constructor(private customerService: CustomerService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new customer account' })
  register(@Body() dto: RegisterDto) {
    return this.customerService.register(dto.email, dto.password, dto.name, dto.phone);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login as customer' })
  login(@Body() dto: LoginDto) {
    return this.customerService.login(dto.email, dto.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current customer profile' })
  async getProfile(@Headers('authorization') auth: string) {
    const customer = await this.extractCustomer(auth);
    return this.customerService.getProfile(customer.id);
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update customer profile' })
  async updateProfile(@Headers('authorization') auth: string, @Body() dto: UpdateProfileDto) {
    const customer = await this.extractCustomer(auth);
    return this.customerService.updateProfile(customer.id, dto);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change customer password' })
  async changePassword(@Headers('authorization') auth: string, @Body() dto: ChangePasswordDto) {
    const customer = await this.extractCustomer(auth);
    return this.customerService.changePassword(customer.id, dto.currentPassword, dto.newPassword);
  }

  @Get('reservations')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all reservations for the logged-in customer' })
  async getMyReservations(@Headers('authorization') auth: string) {
    const customer = await this.extractCustomer(auth);
    return this.customerService.getMyReservations(customer.id);
  }

  // Helper: extract customer from Bearer token
  private async extractCustomer(auth: string) {
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token requerido');
    }
    const token = auth.replace('Bearer ', '');
    const customer = await this.customerService.validateToken(token);
    if (!customer) throw new UnauthorizedException('Token inválido o expirado');
    return customer;
  }
}
