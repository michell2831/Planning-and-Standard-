import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ServiceModeService } from '../service/service-mode.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Permission } from '../../../common/rbac/permission.enum';

@ApiTags('Service Catalogue')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller(['api/service-modes', 'service-modes'])
export class ServiceModeController {
    constructor(private readonly svc: ServiceModeService) { }

    @Get()
    @Roles(Permission.SERVICES_READ)
    @ApiOperation({ summary: 'Get all service modes. Defaults to active only. Pass include_inactive=true to include deactivated modes (Planning Officer).' })
    @ApiQuery({ name: 'include_inactive', required: false, type: Boolean })
    findAll(@Query('include_inactive') includeInactive?: string) {
        const all = includeInactive === 'true';
        return this.svc.findAll(all);
    }

    @Post()
    @Roles(Permission.SERVICE_MODES_WRITE)
    @ApiOperation({ summary: 'Create a new service mode (Planning Officer only)' })
    create(@Body() dto: { name: string; description?: string }) {
        return this.svc.create(dto);
    }

    @Put(':id')
    @Roles(Permission.SERVICE_MODES_WRITE)
    @ApiOperation({ summary: 'Update service mode name/description (Planning Officer only)' })
    update(@Param('id') id: string, @Body() dto: { name?: string; description?: string }) {
        return this.svc.update(id, dto);
    }

    @Patch(':id/toggle')
    @Roles(Permission.SERVICE_MODES_WRITE)
    @ApiOperation({ summary: 'Toggle service mode active/inactive status (Planning Officer only)' })
    toggle(@Param('id') id: string) {
        return this.svc.toggle(id);
    }
}
