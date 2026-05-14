import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEFAULT_COMMODITY_PRICES, DEFAULT_PEMBENIHAN_PRICES, FISH_TYPES, CONTAINER_TYPES } from '@/lib/constants';
import { verifyPassword } from '@/lib/passwords';

// GET /api/commodity-prices - Get all commodity prices in matrix format
export async function GET() {
  try {
    const prices = await db.commodityPrice.findMany();

    // Build a matrix: fishType -> containerType -> price
    const priceMatrix: Record<string, Record<string, number>> = {};

    // Initialize with defaults
    for (const fish of FISH_TYPES) {
      priceMatrix[fish] = {};
      for (const container of CONTAINER_TYPES) {
        const dbPrice = prices.find(p => p.fishType === fish && p.containerType === container);
        priceMatrix[fish][container] = dbPrice ? dbPrice.price : (DEFAULT_COMMODITY_PRICES[fish]?.[container] ?? 0);
      }
    }

    // Include pembenihan prices
    const pembenihanPrices: Record<string, number> = {};
    for (const fish of FISH_TYPES) {
      const dbPrice = prices.find(p => p.fishType === fish && p.containerType === 'Pembenihan');
      pembenihanPrices[fish] = dbPrice ? dbPrice.price : (DEFAULT_PEMBENIHAN_PRICES[fish] ?? 0);
    }

    return NextResponse.json({ prices: priceMatrix, pembenihanPrices });
  } catch (error) {
    console.error('Error fetching commodity prices:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil harga komoditas' },
      { status: 500 }
    );
  }
}

// PUT /api/commodity-prices - Update commodity prices
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, data } = body as {
      password: string;
      data: { fishType: string; containerType: string; price: number }[];
    };

    // Verify password
    const valid = await verifyPassword(password, 'admin');
    if (!valid) {
      return NextResponse.json(
        { error: 'Password tidak valid' },
        { status: 401 }
      );
    }

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: 'Data tidak valid atau kosong' },
        { status: 400 }
      );
    }

    let upserted = 0;

    // Use sequential upserts instead of $transaction
    // Turso/libSQL does not support Prisma interactive transactions
    for (const item of data) {
      if (!item.fishType || !item.containerType) continue;

      try {
        await db.commodityPrice.upsert({
          where: {
            fishType_containerType: {
              fishType: item.fishType,
              containerType: item.containerType,
            },
          },
          update: { price: Number(item.price) || 0, updatedAt: new Date() },
          create: {
            fishType: item.fishType,
            containerType: item.containerType,
            price: Number(item.price) || 0,
          },
        });
        upserted++;
      } catch (itemErr) {
        console.error(`Failed to upsert ${item.fishType}/${item.containerType}:`, itemErr);
        // Continue with other items even if one fails
      }
    }

    return NextResponse.json({ success: true, count: upserted });
  } catch (error) {
    console.error('Error updating commodity prices:', error);
    return NextResponse.json(
      { error: 'Gagal mengupdate harga komoditas' },
      { status: 500 }
    );
  }
}

// POST /api/commodity-prices - Import commodity prices from Excel sheet data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, data } = body as {
      password: string;
      data: { fishType: string; containerType: string; price: number }[];
    };

    // Verify password
    const valid = await verifyPassword(password, 'admin');
    if (!valid) {
      return NextResponse.json(
        { error: 'Password tidak valid' },
        { status: 401 }
      );
    }

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: 'Data tidak valid atau kosong' },
        { status: 400 }
      );
    }

    let upserted = 0;

    // Use sequential upserts instead of $transaction
    for (const item of data) {
      if (!item.fishType || !item.containerType) continue;

      try {
        await db.commodityPrice.upsert({
          where: {
            fishType_containerType: {
              fishType: item.fishType,
              containerType: item.containerType,
            },
          },
          update: { price: Number(item.price) || 0, updatedAt: new Date() },
          create: {
            fishType: item.fishType,
            containerType: item.containerType,
            price: Number(item.price) || 0,
          },
        });
        upserted++;
      } catch (itemErr) {
        console.error(`Failed to upsert ${item.fishType}/${item.containerType}:`, itemErr);
      }
    }

    return NextResponse.json({ success: true, count: upserted });
  } catch (error) {
    console.error('Error importing commodity prices:', error);
    return NextResponse.json(
      { error: 'Gagal mengimpor harga komoditas' },
      { status: 500 }
    );
  }
}
