import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import HomepageContent from '../../../../models/HomepageContent';
import { requireAuthWithRole } from '../../../../lib/requireAuth';
import {
  DEFAULT_HOMEPAGE_BANNERS,
  DEFAULT_HOMEPAGE_SECTIONS,
  formatHomepageContent,
  sanitizeHomepageBanner,
  sanitizeHomepageSection,
} from '../../../../lib/homepageContent';

export async function GET(req: Request) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin']);
  if (!auth.authorized) return auth.response;

  try {
    await dbConnect();
    const content = await HomepageContent.findOne({ key: 'main' }).lean();
    return NextResponse.json({ success: true, data: formatHomepageContent(content) }, { status: 200 });
  } catch (error: any) {
    console.error('/api/admin/homepage GET error', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to load homepage content' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin']);
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const bannersSource = Array.isArray(body?.banners) ? body.banners : DEFAULT_HOMEPAGE_BANNERS;
    const sectionsSource = Array.isArray(body?.sections) ? body.sections : DEFAULT_HOMEPAGE_SECTIONS;

    const banners = bannersSource.map((item: unknown, index: number) => sanitizeHomepageBanner(item, index));
    const sections = sectionsSource.map((item: unknown, index: number) => sanitizeHomepageSection(item, index));

    await dbConnect();
    const content = await HomepageContent.findOneAndUpdate(
      { key: 'main' },
      { $set: { banners, sections } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({ success: true, data: formatHomepageContent(content) }, { status: 200 });
  } catch (error: any) {
    console.error('/api/admin/homepage PUT error', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to save homepage content' }, { status: 400 });
  }
}

