import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OrgsController } from './orgs.controller.js';
import { OrgsService } from './orgs.service.js';
import { RetentionService } from './retention.service.js';

@Module({
  imports: [AuthModule],
  controllers: [OrgsController],
  providers: [OrgsService, RetentionService],
  exports: [OrgsService, RetentionService],
})
export class OrgsModule {}
