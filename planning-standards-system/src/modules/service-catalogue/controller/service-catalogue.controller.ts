import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    Request,
    HttpCode,
    HttpStatus,
    UseGuards,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ServiceCatalogueService } from '../service/service-catalogue.service';
import { CreateServiceDto } from '../dto/create-service.dto';
import { UpdateServiceDto } from '../dto/update-service.dto';
import { CreateIntakeFieldDto } from '../dto/create-intake-field.dto';
import { UpdateIntakeFieldDto } from '../dto/update-intake-field.dto';
import { CreateNaFlagDto } from '../dto/create-na-flag.dto';
import { PaginationDto } from '../dto/pagination.dto';
import { GetServicesQueryDto } from '../dto/get-services-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Permission } from '../../../common/rbac/permission.enum';

@ApiTags('Service Catalogue')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller(['api/services', 'services'])
export class ServiceCatalogueController {
    constructor(private readonly svc: ServiceCatalogueService) { }

    @Get()
    @Roles(Permission.SERVICES_READ)
    @ApiOperation({ summary: 'Get all services for the authenticated office (paginated). Staff role auto-filters N/A and Inactive. Cross-office roles (SUPER_ADMIN, OPCR_EVALUATOR) see all offices.' })
    @ApiQuery({ name: 'classification', required: false })
    @ApiQuery({ name: 'status', required: false })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'include_archived', required: false, type: Boolean })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'sort_by', required: false })
    @ApiQuery({ name: 'sort_order', required: false, enum: ['ASC', 'DESC'] })
    findAll(@Request() req, @Query() query: GetServicesQueryDto) {
        const office = req.user?.office ?? 'unknown-office';
        const role = req.user?.role ?? 'Staff';
        const isCrossOffice = req.user?.isCrossOffice ?? false;
        const { classification, status, search, include_archived, ...pagination } = query;
        return this.svc.findAll(office, { classification, status, search, include_archived }, pagination, role, isCrossOffice);
    }

    @Get('na-flags')
    @ApiOperation({ summary: 'EMS reference — get all NA flags for an office and period' })
    @ApiQuery({ name: 'period_id', required: true })
    getNaFlagsByPeriod(@Request() req, @Query('period_id') period_id: string) {
        const office = req.user?.office ?? 'unknown-office';
        return this.svc.getNaFlagsByOfficeAndPeriod(office, period_id);
    }

    @Delete('na-flags/period/:period_id')
    @Roles(Permission.SERVICES_WRITE)
    @ApiOperation({ summary: 'Bulk remove all N/A flags for a period — called when period is completed' })
    removeNaFlagsByPeriod(@Param('period_id') period_id: string) {
        return this.svc.removeNaFlagsByPeriod(period_id);
    }

    @Get('analytics/summary')
    @Roles(Permission.SERVICES_READ)
    @ApiOperation({ summary: 'Task 8 — institutional count of active services (for dashboard)' })
    getAnalyticsSummary() {
        return this.svc.getAnalyticsSummary();
    }

    @Get(':id')
    @Roles(Permission.SERVICES_READ)
    @ApiOperation({ summary: 'Get a service by ID. Cross-office roles can view services from other offices.' })
    findOne(@Request() req, @Param('id') id: string) {
        const office = req.user?.office ?? 'unknown-office';
        const isCrossOffice = req.user?.isCrossOffice ?? false;
        return this.svc.findOne(id, office, isCrossOffice);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @Roles(Permission.SERVICES_WRITE)
    @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false }))
    @ApiOperation({ summary: 'Create a new service — Admin only' })
    create(@Request() req, @Body() dto: CreateServiceDto) {
        const office = req.user?.office ?? 'unknown-office';
        const actor = req.user?.sub ?? 'system';
        return this.svc.create(office, dto, actor);
    }

    @Put(':id')
    @Roles(Permission.SERVICES_WRITE)
    @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, skipMissingProperties: true }))
    @ApiOperation({ summary: 'Update a service (with audit logging) — Admin only' })
    update(@Request() req, @Param('id') id: string, @Body() dto: UpdateServiceDto) {
        const office = req.user?.office ?? 'unknown-office';
        const actor = req.user?.sub ?? 'system';
        return this.svc.update(id, office, dto, actor);
    }

    @Patch(':id/archive')
    @Roles(Permission.SERVICES_WRITE)
    @ApiOperation({ summary: 'Archive a service — Admin only' })
    archive(@Request() req, @Param('id') id: string) {
        const office = req.user?.office ?? 'unknown-office';
        const actor = req.user?.sub ?? 'system';
        return this.svc.archive(id, office, actor);
    }

    @Patch(':id/activate')
    @Roles(Permission.SERVICES_WRITE)
    @ApiOperation({ summary: 'Activate a service — Admin only' })
    activate(@Request() req, @Param('id') id: string) {
        const office = req.user?.office ?? 'unknown-office';
        const actor = req.user?.sub ?? 'system';
        return this.svc.activate(id, office, actor);
    }

    @Patch(':id/deactivate')
    @Roles(Permission.SERVICES_WRITE)
    @ApiOperation({ summary: 'Deactivate a service — Admin only' })
    deactivate(@Request() req, @Param('id') id: string) {
        const office = req.user?.office ?? 'unknown-office';
        const actor = req.user?.sub ?? 'system';
        return this.svc.deactivate(id, office, actor);
    }

    @Get(':id/intake-fields')
    @Roles(Permission.SERVICES_READ)
    @ApiOperation({ summary: 'Get all intake fields of a service' })
    getIntakeFields(@Request() req, @Param('id') id: string) {
        const office = req.user?.office ?? 'unknown-office';
        return this.svc.getIntakeFields(id, office);
    }

    @Post(':id/intake-fields')
    @HttpCode(HttpStatus.CREATED)
    @Roles(Permission.SERVICES_WRITE)
    @UsePipes(new ValidationPipe({ whitelist: true }))
    @ApiOperation({ summary: 'Add an intake field to a service — Admin only' })
    createIntakeField(@Request() req, @Param('id') id: string, @Body() dto: CreateIntakeFieldDto) {
        const office = req.user?.office ?? 'unknown-office';
        return this.svc.createIntakeField(id, office, dto);
    }

    @Put(':id/intake-fields/:fieldId')
    @Roles(Permission.SERVICES_WRITE)
    @UsePipes(new ValidationPipe({ whitelist: true, skipMissingProperties: true }))
    @ApiOperation({ summary: 'Update an intake field — Admin only' })
    updateIntakeField(@Request() req, @Param('id') id: string, @Param('fieldId') fieldId: string, @Body() dto: UpdateIntakeFieldDto) {
        const office = req.user?.office ?? 'unknown-office';
        return this.svc.updateIntakeField(id, office, fieldId, dto);
    }

    @Delete(':id/intake-fields/:fieldId')
    @Roles(Permission.SERVICES_WRITE)
    @ApiOperation({ summary: 'Deactivate an intake field — Admin only' })
    removeIntakeField(@Request() req, @Param('id') id: string, @Param('fieldId') fieldId: string) {
        const office = req.user?.office ?? 'unknown-office';
        return this.svc.removeIntakeField(id, office, fieldId);
    }

    @Get(':id/na-flags')
    @Roles(Permission.SERVICES_READ)
    @ApiOperation({ summary: 'Get all NA flags of a service' })
    getNaFlags(@Request() req, @Param('id') id: string) {
        const office = req.user?.office ?? 'unknown-office';
        return this.svc.getNaFlags(id, office);
    }

    @Post(':id/na-flags')
    @HttpCode(HttpStatus.CREATED)
    @Roles(Permission.SERVICES_WRITE)
    @UsePipes(new ValidationPipe({ whitelist: true }))
    @ApiOperation({ summary: 'Flag a service as Not Applicable for a period — Admin only' })
    createNaFlag(@Request() req, @Param('id') id: string, @Body() dto: CreateNaFlagDto) {
        const office = req.user?.office ?? 'unknown-office';
        const actor = req.user?.sub ?? 'system';
        return this.svc.createNaFlag(id, office, dto, actor);
    }

    @Patch(':id/unflag')
    @Roles(Permission.SERVICES_WRITE)
    @ApiOperation({ summary: 'Remove N/A flag from a service for the active period — Admin only' })
    unflagService(@Request() req, @Param('id') id: string, @Query('period_id') period_id: string) {
        const office = req.user?.office ?? 'unknown-office';
        return this.svc.unflagService(id, office, period_id);
    }

    @Delete(':id/na-flags/:flagId')
    @Roles(Permission.SERVICES_WRITE)
    @ApiOperation({ summary: 'Lift a specific NA flag by ID — Admin only' })
    removeNaFlag(@Request() req, @Param('id') id: string, @Param('flagId') flagId: string) {
        const office = req.user?.office ?? 'unknown-office';
        return this.svc.removeNaFlag(id, office, flagId);
    }
}
