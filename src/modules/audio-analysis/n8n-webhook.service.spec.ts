import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { N8NWebhookService } from './n8n-webhook.service';
import { N8NWebhookPayloadDto } from './dto/webhook.dto';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('N8NWebhookService', () => {
  let service: N8NWebhookService;

  const mockConfigService = {
    get: jest.fn(),
  };

  const createService = async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        N8NWebhookService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<N8NWebhookService>(N8NWebhookService);
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Set default configuration
    mockConfigService.get.mockImplementation(
      (key: string, defaultValue?: any) => {
        switch (key) {
          case 'N8N_WEBHOOK_URL':
            return 'https://n8n.example.com/webhook/test';
          case 'N8N_WEBHOOK_SECRET':
            return 'test-secret';
          default:
            return defaultValue;
        }
      },
    );
    await createService();
  });

  describe('triggerWebhook', () => {
    const mockPayload: N8NWebhookPayloadDto = {
      jobId: 'test-job-id',
      fileUrl: 'https://example.com/test.mp3',
      timestamp: '2023-01-01T00:00:00.000Z',
    };

    it('should successfully trigger webhook with secret', async () => {
      const mockResponse = {
        status: 200,
        data: { success: true },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      await service.triggerWebhook(mockPayload);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://n8n.example.com/webhook/test',
        mockPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-n8n-webhook-secret': 'test-secret',
          },
          timeout: 10000,
        },
      );
    });

    it('should successfully trigger webhook without secret', async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          switch (key) {
            case 'N8N_WEBHOOK_URL':
              return 'https://n8n.example.com/webhook/test';
            case 'N8N_WEBHOOK_SECRET':
              return undefined;
            default:
              return defaultValue;
          }
        },
      );
      await createService();

      const mockResponse = {
        status: 201,
        data: { success: true },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      await service.triggerWebhook(mockPayload);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://n8n.example.com/webhook/test',
        mockPayload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );
    });

    it('should skip webhook trigger when URL is not configured', async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          switch (key) {
            case 'N8N_WEBHOOK_URL':
              return '';
            case 'N8N_WEBHOOK_SECRET':
              return 'test-secret';
            default:
              return defaultValue;
          }
        },
      );
      await createService();

      await service.triggerWebhook(mockPayload);

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should skip webhook trigger when URL is undefined', async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          switch (key) {
            case 'N8N_WEBHOOK_URL':
              return undefined;
            case 'N8N_WEBHOOK_SECRET':
              return 'test-secret';
            default:
              return defaultValue;
          }
        },
      );
      await createService();

      await service.triggerWebhook(mockPayload);

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should throw error for non-2xx HTTP status responses', async () => {
      const mockResponse = {
        status: 400,
        data: { error: 'Bad Request' },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      await expect(service.triggerWebhook(mockPayload)).rejects.toThrow(
        'N8N webhook returned status 400: {"error":"Bad Request"}',
      );
    });

    it('should handle axios error responses', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 500,
          data: { error: 'Internal Server Error' },
        },
      };
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.post.mockRejectedValue(axiosError);

      await expect(service.triggerWebhook(mockPayload)).rejects.toThrow(
        'N8N webhook error: 500 - {"error":"Internal Server Error"}',
      );
    });

    it('should handle network errors without response', async () => {
      const networkError = new Error('Network Error');
      mockedAxios.isAxiosError.mockReturnValue(false);
      mockedAxios.post.mockRejectedValue(networkError);

      await expect(service.triggerWebhook(mockPayload)).rejects.toThrow(
        'Network Error',
      );
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout of 10000ms exceeded');
      Object.assign(timeoutError, {
        isAxiosError: true,
        code: 'ECONNABORTED',
      });
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.post.mockRejectedValue(timeoutError);

      await expect(service.triggerWebhook(mockPayload)).rejects.toThrow(
        timeoutError,
      );
    });

    it('should handle various 2xx status codes as success', async () => {
      const successStatuses = [200, 201, 202, 204];

      for (const status of successStatuses) {
        const mockResponse = {
          status,
          data: { success: true },
        };
        mockedAxios.post.mockResolvedValue(mockResponse);

        await expect(
          service.triggerWebhook(mockPayload),
        ).resolves.not.toThrow();
      }
    });

    it('should handle 3xx status codes as errors', async () => {
      const mockResponse = {
        status: 300,
        data: { redirect: 'https://example.com/new-endpoint' },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      await expect(service.triggerWebhook(mockPayload)).rejects.toThrow(
        'N8N webhook returned status 300',
      );
    });

    it('should include all required payload fields', async () => {
      const mockResponse = {
        status: 200,
        data: { success: true },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      await service.triggerWebhook(mockPayload);

      const [url, payload, config] = mockedAxios.post.mock.calls[0];
      expect(url).toBe('https://n8n.example.com/webhook/test');
      expect(payload).toEqual({
        jobId: 'test-job-id',
        fileUrl: 'https://example.com/test.mp3',
        timestamp: '2023-01-01T00:00:00.000Z',
      });
      expect(config?.timeout).toBe(10000);
      expect(config?.headers?.['Content-Type']).toBe('application/json');
    });

    it('should handle different webhook URL formats', async () => {
      const testUrls = [
        'https://n8n.example.com/webhook/audio-analysis',
        'http://localhost:5678/webhook/test',
        'https://workflow.company.com/api/webhooks/audio-process',
      ];

      for (const webhookUrl of testUrls) {
        mockConfigService.get.mockImplementation(
          (key: string, defaultValue?: any) => {
            switch (key) {
              case 'N8N_WEBHOOK_URL':
                return webhookUrl;
              case 'N8N_WEBHOOK_SECRET':
                return 'test-secret';
              default:
                return defaultValue;
            }
          },
        );
        await createService();

        const mockResponse = {
          status: 200,
          data: { success: true },
        };
        mockedAxios.post.mockResolvedValue(mockResponse);

        await service.triggerWebhook(mockPayload);

        expect(mockedAxios.post).toHaveBeenCalledWith(
          webhookUrl,
          mockPayload,
          expect.any(Object),
        );

        jest.clearAllMocks();
      }
    });

    it('should handle different webhook secret formats', async () => {
      const testSecrets = [
        'simple-secret',
        'complex-secret-123!@#',
        'very-long-secret-key-with-special-chars-$%^&*()',
      ];

      for (const secret of testSecrets) {
        mockConfigService.get.mockImplementation(
          (key: string, defaultValue?: any) => {
            switch (key) {
              case 'N8N_WEBHOOK_URL':
                return 'https://n8n.example.com/webhook/test';
              case 'N8N_WEBHOOK_SECRET':
                return secret;
              default:
                return defaultValue;
            }
          },
        );
        await createService();

        const mockResponse = {
          status: 200,
          data: { success: true },
        };
        mockedAxios.post.mockResolvedValue(mockResponse);

        await service.triggerWebhook(mockPayload);

        expect(mockedAxios.post).toHaveBeenCalledWith(
          'https://n8n.example.com/webhook/test',
          mockPayload,
          {
            headers: {
              'Content-Type': 'application/json',
              'x-n8n-webhook-secret': secret,
            },
            timeout: 10000,
          },
        );

        jest.clearAllMocks();
      }
    });
  });
});
