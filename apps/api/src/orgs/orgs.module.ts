import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OrgsController } from './orgs.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [OrgsController],
})
export class OrgsModule {}
