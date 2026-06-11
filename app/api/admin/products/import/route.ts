import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/mongodb';
import Product from '../../../../../models/Product';
import { buildProductPayload, formatProduct, slugify } from '../../../../../lib/adminProduct';
import { requireAuthWithRole } from '../../../../../lib/requireAuth';

type JsonRecord = Record<string, unknown>;

const TEMPLATE_FIELDS = [
  'name',
  'sku',
  'price',
  'compare_at_price',
  'discount',
  'stock',
  'category',
  'collection_id',
  'brand',
  'description',
  'short_description',
  'images',
  'colors',
  'specs',
  'status',
];

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function parseMaybeJson(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (!['[', '{'].includes(trimmed[0])) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function splitList(value: unknown) {
  const parsed = parseMaybeJson(value);
  if (Array.isArray(parsed)) return parsed;
  return cleanString(parsed)
    .split(/[|,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSpecs(value: unknown) {
  const parsed = parseMaybeJson(value);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;

  const specs: JsonRecord = {};
  cleanString(value)
    .split(/[|;]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const [key, ...rest] = entry.split(':');
      if (!key || rest.length === 0) return;
      specs[key.trim()] = rest.join(':').trim();
    });
  return specs;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(current);
      current = '';
      if (row.some((cell) => cleanString(cell))) rows.push(row);
      row = [];
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((cell) => cleanString(cell))) rows.push(row);
  if (rows.length <= 1) return [];

  const headers = rows[0].map((header) => cleanString(header).toLowerCase().replace(/\s+/g, '_'));
  return rows.slice(1).map((cells) => {
    const record: JsonRecord = {};
    headers.forEach((header, index) => {
      if (!header) return;
      record[header] = cleanString(cells[index]);
    });
    return record;
  });
}

async function readImportRecords(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    const rawProducts = form.get('products');
    const text = typeof rawProducts === 'string' && rawProducts.trim() ? rawProducts : null;

    if (text) return parseImportText(text, form.get('format'));
    if (file && typeof file === 'object' && 'text' in file) {
      return parseImportText(await (file as File).text(), form.get('format') || (file as File).name);
    }
    return [];
  }

  if (contentType.includes('application/json')) {
    const body = await req.json();
    if (Array.isArray(body)) return body;
    if (Array.isArray(body?.products)) return body.products;
    if (typeof body?.csv === 'string') return parseCsv(body.csv);
    if (typeof body?.text === 'string') return parseImportText(body.text, body.format);
    return [];
  }

  return parseImportText(await req.text(), contentType);
}

function parseImportText(text: string, formatHint?: unknown) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const hint = cleanString(formatHint).toLowerCase();

  if (hint.includes('csv') || (!trimmed.startsWith('[') && !trimmed.startsWith('{'))) {
    return parseCsv(trimmed);
  }

  const parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.products)) return parsed.products;
  return [];
}

function normalizeImportRecord(input: unknown) {
  const record = asRecord(input);
  const normalized: JsonRecord = {
    ...record,
    name: record.name ?? record.title ?? record.product_name,
    title: record.title ?? record.name ?? record.product_name,
    category: record.category ?? record.category_id ?? record.fabric_type,
    category_id: record.category_id ?? record.category ?? record.fabric_type,
    collection_id: record.collection_id ?? record.collection,
    brand: record.brand ?? record.brand_name,
    short_description: record.short_description ?? record.shortDescription,
    compare_at_price: record.compare_at_price ?? record.old_price ?? record.oldPrice ?? record.compareAtPrice,
    isFeatured: record.isFeatured ?? record.is_featured,
  };

  if (record.images !== undefined || record.image_urls !== undefined || record.image !== undefined) {
    const images = splitList(record.images ?? record.image_urls ?? record.image);
    normalized.images = images;
    normalized.image = images[0] || record.image || null;
  }

  if (record.colors !== undefined) normalized.colors = splitList(record.colors);
  if (record.specs !== undefined) normalized.specs = parseSpecs(record.specs);
  if (record.details !== undefined) normalized.details = parseMaybeJson(record.details);

  return normalized;
}

function buildLookup(payload: JsonRecord) {
  const sku = cleanString(payload.sku);
  const slug = cleanString(payload.slug) || slugify(payload.title || payload.name);
  if (sku) return { sku };
  return { slug };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin']);
  if (!auth.authorized) return auth.response;

  return NextResponse.json({
    success: true,
    data: {
      fields: TEMPLATE_FIELDS,
      csvHeader: TEMPLATE_FIELDS.join(','),
      example: {
        name: 'Ankara Bloom Wax Print',
        sku: 'ANK-BLOOM-001',
        price: 4500,
        compare_at_price: 6000,
        stock: 40,
        category: 'Ankara',
        collection_id: 'new-arrivals',
        images: 'https://example.com/image-1.jpg|https://example.com/image-2.jpg',
        specs: 'fabricType:Ankara wax print;materialComposition:Cotton wax',
        status: 'published',
      },
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin']);
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const records = await readImportRecords(req);
    const results: JsonRecord[] = [];
    const errors: JsonRecord[] = [];
    let created = 0;
    let updated = 0;

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ success: false, error: 'No product records found in import file' }, { status: 400 });
    }

    for (let index = 0; index < records.length; index += 1) {
      try {
        const row = normalizeImportRecord(records[index]);
        const payload = buildProductPayload(row, 'create');
        const lookup = buildLookup(payload);
        const existing = await Product.findOne(lookup).select('_id').lean();

        const product = await Product.findOneAndUpdate(
          lookup,
          { $set: payload },
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
          }
        );

        if (existing) updated += 1;
        else created += 1;

        results.push({
          row: index + 1,
          action: existing ? 'updated' : 'created',
          product: formatProduct(product),
        });
      } catch (error) {
        errors.push({
          row: index + 1,
          error: error instanceof Error ? error.message : 'Failed to import row',
          input: records[index],
        });
      }
    }

    return NextResponse.json(
      {
        success: errors.length === 0,
        imported: results.length,
        created,
        updated,
        failed: errors.length,
        results,
        errors,
      },
      { status: errors.length === records.length ? 400 : 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to import products';
    console.error('/api/admin/products/import POST error', error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
