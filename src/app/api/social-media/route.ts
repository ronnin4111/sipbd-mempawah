import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET — list all active social media posts, sorted by pinned first then sortOrder
export async function GET(req: NextRequest) {
  try {
    const platform = req.nextUrl.searchParams.get('platform');
    const admin = req.nextUrl.searchParams.get('admin') === 'true';

    const where: Record<string, unknown> = {};
    if (!admin) where.isActive = true;
    if (platform) where.platform = platform;

    const posts = await db.socialMediaPost.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    // Sort in JS to put pinned first (SQLite doesn't reliably sort booleans DESC)
    posts.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('[social-media] GET error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data media sosial' }, { status: 500 });
  }
}

// POST — add a new social media post (admin only)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { postUrl, platform, caption, thumbnailUrl, isPinned, sortOrder, adminPassword } = body;

    // Verify admin password
    if (!adminPassword) {
      return NextResponse.json({ error: 'Password admin diperlukan' }, { status: 401 });
    }
    const setting = await db.appSetting.findUnique({ where: { key: 'admin_password' } });
    if (!setting || setting.value !== adminPassword) {
      return NextResponse.json({ error: 'Password admin salah' }, { status: 401 });
    }

    if (!postUrl || !platform) {
      return NextResponse.json({ error: 'URL post dan platform wajib diisi' }, { status: 400 });
    }

    // Generate embed URL based on platform
    let embedUrl = '';
    if (platform === 'instagram') {
      // Extract shortcode from Instagram URL
      // Formats: https://www.instagram.com/p/SHORTCODE/ or /reel/SHORTCODE/
      const match = postUrl.match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
      if (match) {
        embedUrl = `https://www.instagram.com/p/${match[2]}/embed/`;
      }
    } else if (platform === 'youtube') {
      // Extract YouTube video ID
      const match = postUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]+)/);
      if (match) {
        embedUrl = `https://www.youtube.com/embed/${match[1]}`;
      }
    } else if (platform === 'tiktok') {
      // TikTok embed
      const match = postUrl.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
      if (match) {
        embedUrl = `https://www.tiktok.com/embed/v2/${match[1]}`;
      }
    } else if (platform === 'facebook') {
      // Facebook embed — use the post URL directly in iframe
      embedUrl = `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(postUrl)}`;
    } else if (platform === 'twitter') {
      // Twitter/X embed — will use blockquote approach on frontend
      embedUrl = postUrl;
    }

    const post = await db.socialMediaPost.create({
      data: {
        platform,
        postUrl,
        embedUrl,
        caption: caption || '',
        thumbnailUrl: thumbnailUrl || '',
        isPinned: isPinned || false,
        sortOrder: sortOrder || 0,
        isActive: true,
        addedBy: 'admin',
      },
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error('[social-media] POST error:', error);
    return NextResponse.json({ error: 'Gagal menambahkan post media sosial' }, { status: 500 });
  }
}

// PUT — update a social media post
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, caption, thumbnailUrl, isPinned, sortOrder, isActive, adminPassword } = body;

    if (!adminPassword) {
      return NextResponse.json({ error: 'Password admin diperlukan' }, { status: 401 });
    }
    const setting = await db.appSetting.findUnique({ where: { key: 'admin_password' } });
    if (!setting || setting.value !== adminPassword) {
      return NextResponse.json({ error: 'Password admin salah' }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: 'ID post diperlukan' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (caption !== undefined) updateData.caption = caption;
    if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;
    if (isPinned !== undefined) updateData.isPinned = isPinned;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isActive !== undefined) updateData.isActive = isActive;

    const post = await db.socialMediaPost.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ post });
  } catch (error) {
    console.error('[social-media] PUT error:', error);
    return NextResponse.json({ error: 'Gagal mengupdate post' }, { status: 500 });
  }
}

// DELETE — delete a social media post
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, adminPassword } = body;

    if (!adminPassword) {
      return NextResponse.json({ error: 'Password admin diperlukan' }, { status: 401 });
    }
    const setting = await db.appSetting.findUnique({ where: { key: 'admin_password' } });
    if (!setting || setting.value !== adminPassword) {
      return NextResponse.json({ error: 'Password admin salah' }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: 'ID post diperlukan' }, { status: 400 });
    }

    await db.socialMediaPost.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[social-media] DELETE error:', error);
    return NextResponse.json({ error: 'Gagal menghapus post' }, { status: 500 });
  }
}
