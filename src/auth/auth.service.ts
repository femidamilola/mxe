import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { MessageService } from 'src/utils/message.service';
import {
  CreateAccountDto,
  RequestMobileVerification,
  VerifyMobileNumberDto,
} from './dto/auth.dto';
import { UtilService } from 'src/utils/util.service';
import { hash } from 'argon2';

@Injectable()
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private messageService: MessageService,
    private utilService: UtilService,
  ) {}

  async requestMobileVerification(
    dto: RequestMobileVerification,
    type: 'mobile' | 'email',
  ) {
    try {
      const userExists = await this.prismaService.user.findFirst({
        where: { mobileNumber: dto.mobileNumber },
      });
      if (userExists && userExists.isMobileVerified === true) {
        throw new HttpException(
          'User with mobile number already exists',
          HttpStatus.BAD_REQUEST,
        );
      }

      // delete user if it exists and mobile is not verified
      if (userExists && userExists.isMobileVerified === false) {
        await this.prismaService.user.delete({ where: { id: userExists.id } });
      }

      const otp = this.utilService.generateOtp();

      console.log(otp);

      // send message if type is mobile
      if (type === 'mobile') {
        const parsesedMobileNumber = this.utilService.parseMobileNumber(
          dto.mobileNumber,
        );
        await this.messageService.sendTestMessage(
          `${dto.countryCode}${parsesedMobileNumber}`,
          `Your mobile verification otp is ${otp}`,
        );

        const user = await this.prismaService.user.create({
          data: {
            mobileNumber: dto.mobileNumber,
          },
        });

        // hash the token using jwt and save

        await this.prismaService.otp.create({
          data: { otp: otp, user: { connect: { id: user.id } } },
        });

        return {
          message: 'Verifiation message sent',
        };
      }
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async verifyMobile(dto: VerifyMobileNumberDto) {
    try {
      const user = await this.prismaService.user.findFirst({
        where: { mobileNumber: dto.mobileNumber },
      });

      if (!user) {
        throw new HttpException('User does not exist', HttpStatus.BAD_REQUEST);
      }

      if (user.isMobileVerified === true) {
        throw new HttpException(
          'Mobile number already verified',
          HttpStatus.BAD_REQUEST,
        );
      }

      const otpExists = await this.prismaService.otp.findFirst({
        where: { userId: user.id },
      });
      if (!otpExists) {
        throw new HttpException(
          'Mobile verification otp not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (otpExists.otp !== dto.otp) {
        throw new HttpException('Invalid otp', HttpStatus.UNAUTHORIZED);
      }

      await this.prismaService.user.update({
        where: { id: user.id },
        data: { isMobileVerified: true },
      });

      await this.prismaService.otp.delete({ where: { id: otpExists.id } });

      return { message: 'Mobile number verified successfully' };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async checkMxeTagExists(mxeTag: string) {
    try {
      const mxeTagExists = await this.prismaService.account.findFirst({
        where: { mxeTag: mxeTag },
      });
      if (mxeTagExists) {
        throw new HttpException(
          'Mxe Tag already in use',
          HttpStatus.BAD_REQUEST,
        );
      }
      return { message: 'Mxe Tag is not in use' };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createAccount(dto: CreateAccountDto) {
    try {
      const accountExists = await this.prismaService.account.findFirst({
        where: { email: dto.email },
      });
      if (accountExists) {
        throw new HttpException(
          'An account with that email already exists',
          HttpStatus.UNAUTHORIZED,
        );
      }
      const account = await this.prismaService.account.create({
        data: {
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          mxeTag: dto.mxeTag,
          user: {
            connect: { id: dto.userId },
          },
          pin: await hash(dto.pin),
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          mxeTag: true,
          // createdAt: true
        },
      });

      return { message: 'Account created', data: account };
    } catch (error) {
      if (error.code === 'P2025') {
        throw new HttpException('User does not exists', HttpStatus.NOT_FOUND);
      }
      console.log(error);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
