import { ArgumentsHost } from '@nestjs/common';
import { I18nValidationFilter } from './i18n-validation.filter';
import { I18nValidationException } from 'nestjs-i18n';

describe('I18nValidationFilter', () => {
  let filter: I18nValidationFilter;
  let mockResponse: any;
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(() => {
    filter = new I18nValidationFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should format simple validation errors', () => {
    const mockErrors = [
      {
        property: 'email',
        constraints: { isEmail: 'email must be an email' },
      },
      {
        property: 'password',
        constraints: { minLength: 'password must be longer than or equal to 6 characters' },
      },
    ];

    const exception = new I18nValidationException(mockErrors as any);

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: 'Error en la validación',
      statusCode: 400,
      errors: {
        email: ['email must be an email'],
        password: ['password must be longer than or equal to 6 characters'],
      },
    });
  });

  it('should format nested validation errors', () => {
    const mockErrors = [
      {
        property: 'user',
        children: [
          {
            property: 'profile',
            children: [
              {
                property: 'age',
                constraints: { min: 'age must not be less than 18' },
              },
            ],
          },
          {
            property: 'name',
            constraints: { isNotEmpty: 'name should not be empty' },
          },
        ],
      },
    ];

    const exception = new I18nValidationException(mockErrors as any);

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: 'Error en la validación',
      statusCode: 400,
      errors: {
        'user.profile.age': ['age must not be less than 18'],
        'user.name': ['name should not be empty'],
      },
    });
  });
});
