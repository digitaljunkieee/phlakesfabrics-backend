function mockResponse(status: number, body: unknown, statusText = 'OK') {
  const text = typeof body === 'string' ? body : JSON.stringify(body);

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: jest.fn().mockResolvedValue(text),
  } as unknown as Response;
}

const gigEnv = {
  GIG_BASE_URL: 'https://gig.example.test',
  GIG_EMAIL: 'merchant@example.test',
  GIG_PASSWORD: 'secret',
  GIG_ORGANISATION: 'Phlakes Fabrics',
  GIG_USER_CHANNEL_CODE: 'MERCHANT001',
  GIG_SENDER_NAME: 'Phlakes Fabrics Store',
  GIG_SENDER_PHONE_NUMBER: '08000000000',
  GIG_SENDER_ADDRESS: 'Owerri, Imo State',
  GIG_SENDER_LOCALITY: 'Owerri',
  GIG_SENDER_CITY: 'Owerri',
  GIG_SENDER_STATION_ID: '4',
  GIG_RECEIVER_STATION_ID: '2',
  GIG_DESTINATION_STATION_ID: '2',
  GIG_DESTINATION_SERVICE_CENTER_ID: '14',
};

describe('gigService', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, ...gigEnv };
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('getGigToken extracts the nested access-token from the login response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockResponse(200, {
        success: true,
        data: {
          message: 'Success',
          status: 200,
          data: {
            'access-token': 'token-123',
          },
        },
      })
    );

    const { getGigToken } = await import('../../lib/gigService');
    const token = await getGigToken();

    expect(token).toBe('token-123');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://gig.example.test/login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Accept: 'application/json',
          UserChannelCode: 'MERCHANT001',
        }),
      })
    );
  });

  test('createGigWaybill sends preshipment requests with access-token auth', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        mockResponse(200, {
          success: true,
          data: {
            data: {
              'access-token': 'token-abc',
            },
          },
        })
      )
      .mockResolvedValueOnce(
        mockResponse(200, {
          success: true,
          data: {
            message: 'Shipment created successfully.',
            data: {
              Waybill: '1349107274',
            },
          },
        })
      );

    const { createGigWaybill } = await import('../../lib/gigService');
    const waybill = await createGigWaybill({
      email: 'buyer@example.com',
      user: { name: 'Jane Buyer', phone: '08012345678' },
      shippingAddress: {
        street: '12 Example Street',
        city: 'Owerri',
        lga: 'Owerri Municipal',
        state: 'Imo',
        phone: '08012345678',
      },
      items: [
        {
          quantity: 2,
          price: 4500,
          product: { title: 'Phlakes Fabrics Blender' },
        },
      ],
    });

    const secondCall = (global.fetch as jest.Mock).mock.calls[1];
    const [, requestInit] = secondCall;
    const parsedBody = JSON.parse(requestInit.body as string);

    expect(waybill).toBe('1349107274');
    expect(secondCall[0]).toBe('https://gig.example.test/capture/preshipment');
    expect(requestInit.headers).toEqual(
      expect.objectContaining({
        'Content-Type': 'application/json',
        'access-token': 'token-abc',
        Accept: 'application/json',
        UserChannelCode: 'MERCHANT001',
      })
    );
    expect(requestInit.headers).not.toHaveProperty('Authorization');
    expect(parsedBody.ReceiverDetails.ReceiverName).toBe('Jane Buyer');
  });

  test('createGigWaybill uses the documented dropoff endpoint', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        mockResponse(200, {
          success: true,
          data: {
            data: {
              'access-token': 'token-dropoff',
            },
          },
        })
      )
      .mockResolvedValueOnce(
        mockResponse(200, {
          success: true,
          data: {
            data: {
              TempCode: 'PRE000568-APH',
            },
          },
        })
      );

    const { createGigWaybill } = await import('../../lib/gigService');
    const tempCode = await createGigWaybill(
      {
        email: 'buyer@example.com',
        shippingAddress: {
          street: '12 Example Street',
          city: 'Owerri',
          state: 'Imo',
          phone: '08012345678',
        },
        items: [
          {
            quantity: 1,
            price: 1200,
            product: { title: 'Phlakes Fabrics Toaster' },
          },
        ],
      },
      'dropoff'
    );

    expect(tempCode).toBe('PRE000568-APH');
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe(
      'https://gig.example.test/create/dropOff'
    );
  });

  test('createGigWaybill surfaces non-json upstream errors', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        mockResponse(200, {
          success: true,
          data: {
            data: {
              'access-token': 'token-err',
            },
          },
        })
      )
      .mockResolvedValueOnce(mockResponse(406, '<html>Not Acceptable</html>', 'Not Acceptable'));

    const { createGigWaybill } = await import('../../lib/gigService');

    await expect(
      createGigWaybill({
        email: 'buyer@example.com',
        shippingAddress: {
          street: '12 Example Street',
          city: 'Owerri',
          state: 'Imo',
          phone: '08012345678',
        },
        items: [
          {
            quantity: 1,
            price: 1200,
            product: { title: 'Phlakes Fabrics Toaster' },
          },
        ],
      })
    ).rejects.toThrow('GIG preshipment capture failed: HTTP 406 - <html>Not Acceptable</html>');
  });

  test('missing GIG env fails before using any fallback test account', async () => {
    delete process.env.GIG_EMAIL;

    const { getGigToken } = await import('../../lib/gigService');

    await expect(getGigToken()).rejects.toThrow('Missing GIG_EMAIL');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
