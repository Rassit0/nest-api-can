import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsUUID } from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";
import { Exists } from "src/common/validators/decorators/exists.decorator";

export class CreateStaffDto {
    @ApiProperty({
        example: '550e8400-e29b-41d4-a716-446655440000',
        description: 'ID de la persona',
    })
    @IsUUID('4', {
        message: i18nValidationMessage('validation.IS_UUID', {
            constraint1: 'personId',
        }),
    })
    @Exists('person', 'id', {
        message: i18nValidationMessage('validation.NOT_EXISTS', {
            constraint1: 'personId',
        }),
    })
    personId: string;

    @ApiProperty({
        example: true,
        description: 'Está activo el jugador',
    })
    @IsBoolean({
        message: i18nValidationMessage('validation.IS_BOOLEAN', {
            constraint1: 'isActive',
        }),
    })
    @IsOptional()
    isActive?: boolean;
}
