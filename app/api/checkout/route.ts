import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../lib/mongodb';
import Branch from '../../../models/Branch';
import Inventory from '../../../models/Inventory';
import InventoryLog from '../../../models/InventoryLog';
import Product from '../../../models/Product';
import Order from '../../../models/Order';
import { getUserFromRequest } from '../../../lib/auth';
import { initializepaystack, PAYSTACK_CALLBACK_URL } from '../../../lib/paystack.server';
import { sendAdminOrderAlertEmail, sendOrderCreatedEmail } from '../../../lib/email';
import { selectFulfillmentBranch } from '../../../lib/branchFulfillment';

function parseMoney(value: any) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (value == null) return 0;
    const parsed = Number(String(value).replace(/[^0-9.-]+/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

function cleanString(value: any) {
    return String(value ?? '').trim();
}

function parseCoordinate(value: any) {
    const coordinate = Number(value);
    return Number.isFinite(coordinate) ? coordinate : null;
}

function normalizeFulfillmentType(value: any) {
    const normalized = cleanString(value).toLowerCase();
    return normalized === 'pickup' ? 'pickup' : 'delivery';
}

function normalizeHexColor(value: any) {
    const trimmed = cleanString(value);
    if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
    if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed}`;
    return '';
}

function normalizeProductColors(product: any) {
    const raw = Array.isArray(product?.colors)
        ? product.colors
        : typeof product?.colors === 'string'
            ? (() => {
                try {
                    const parsed = JSON.parse(product.colors);
                    return Array.isArray(parsed) ? parsed : product.colors.split(/[|,;]/);
                } catch {
                    return product.colors.split(/[|,;]/);
                }
            })()
            : [];

    return raw
        .map((color: any) => {
            if (typeof color === 'string') return { name: cleanString(color), hex: '' };
            return {
                name: cleanString(color?.name || color?.label || color?.value),
                hex: normalizeHexColor(color?.hex || color?.color || color?.code),
            };
        })
        .filter((color: any) => color.name);
}

function productLookupQuery(identifier: string) {
    const clauses: Record<string, any>[] = [{ slug: identifier }, { id: identifier }, { external_id: identifier }, { product_id: identifier }];
    if (mongoose.Types.ObjectId.isValid(identifier)) clauses.unshift({ _id: identifier });
    return { $or: clauses };
}

async function resolveProduct(identifier: string) {
    const normalized = String(identifier || '').trim();
    if (!normalized) return null;
    return Product.findOne(productLookupQuery(normalized)).lean();
}

async function normalizeItems(items: any[] = []) {
    const resolved: any[] = [];

    for (const item of items) {
        const identifier = item.product_id || item.productId || item._id || item.id;
        const product = await resolveProduct(String(identifier || ''));

        if (!product) {
            throw new Error(`Product not found for cart item "${item.name || identifier || 'unknown'}"`);
        }

        const quantity = Math.max(1, Number(item.quantity || item.qty || 1) || 1);
        const productPrice = parseMoney((product as any).price);
        const price = productPrice > 0 ? productPrice : parseMoney(item.price);
        const weight = parseMoney(item.weight) || parseMoney((product as any).weight) || parseMoney((product as any).specs?.weight) || 1;
        const selectedUnit = cleanString(item.selectedUnit || item.unit || item.selected_unit) || 'Per Yard';
        const requestedColor = cleanString(item.selectedColor || item.selected_color || item.color || item.colour);
        const productColors = normalizeProductColors(product);
        const selectedProductColor = requestedColor
            ? productColors.find((color: any) => color.name.toLowerCase() === requestedColor.toLowerCase()) || null
            : null;

        if (productColors.length > 0 && !requestedColor) {
            throw new Error(`Please choose a color for "${(product as any).name || (product as any).title || item.name || 'this product'}".`);
        }

        if (requestedColor && productColors.length > 0 && !selectedProductColor) {
            throw new Error(`"${requestedColor}" is not an available color for "${(product as any).name || (product as any).title || item.name || 'this product'}".`);
        }

        const fulfillmentType = normalizeFulfillmentType(item.fulfillmentType || item.fulfillment_type);
        const selectedBranchId = cleanString(item.selectedBranchId || item.selected_branch_id || item.branchId || item.branch_id || item.pickupBranch?.branchId);
        const selectedBranchName = cleanString(item.selectedBranchName || item.selected_branch_name || item.branchName || item.branch_name || item.pickupBranch?.branchName);

        resolved.push({
            ...item,
            product_id: String((product as any)._id),
            id: item.id || String((product as any)._id),
            name: item.name || item.title || (product as any).name || (product as any).title || '',
            quantity,
            qty: quantity,
            price,
            weight,
            selectedUnit,
            selectedColor: selectedProductColor?.name || requestedColor || '',
            selectedColorHex: selectedProductColor?.hex || normalizeHexColor(item.selectedColorHex || item.selected_color_hex) || '',
            fulfillmentType,
            selectedBranchId,
            selectedBranchName,
            product,
        });
    }

    return resolved;
}

export async function POST(req: Request) {
    const user = await getUserFromRequest(req);
    const userId = user?.id || null;
    const userEmail = user?.email || null;

    try {
        const body = await req.json();
        const rawItems = Array.isArray(body.items) ? body.items : [];
        await dbConnect();

        const { email: requestedEmail, shipping_address, total_amount, total, customer, idempotency_key: bodyIdempotencyKey } = body;
        const items = await normalizeItems(rawItems);
        const itemProductIds = items.map((item: any) => String(item.product_id || item.id || '')).filter(Boolean);

        const email = userEmail || requestedEmail || customer?.email;
        const headerIdempotencyKey = req.headers.get('idempotency-key');
        
        // 🚨 FIX: Automatically generate a unique key if one isn't provided. 
        // This stops MongoDB from throwing the "Duplicate Null" error!
        const idempotencyKey = headerIdempotencyKey || bodyIdempotencyKey || new mongoose.Types.ObjectId().toString();

        const computedItemsTotal = items.reduce((sum: number, item: any) => sum + (Number(item.price) * Number(item.quantity)), 0);
        const finalTotal = parseMoney(total_amount) || parseMoney(total) || parseMoney(body.amount) || computedItemsTotal;
        const safeStreet = customer?.address || (typeof shipping_address === 'string' ? shipping_address : 'Address not provided');
        const safeCity = customer?.city || body.city || customer?.lga || body.lga || 'lagos';
        const safeState = customer?.state || body.state || 'Imo';
        const safePhone = customer?.phone || body.phone || '0000000000';
        const safeLga = customer?.lga || body.lga || customer?.city || body.city || '';
        const customerLatitude = parseCoordinate(
            customer?.latitude ??
            customer?.lat ??
            body.latitude ??
            body.lat ??
            body.customerLatitude ??
            body.customer_latitude
        );
        const customerLongitude = parseCoordinate(
            customer?.longitude ??
            customer?.lng ??
            customer?.lon ??
            body.longitude ??
            body.lng ??
            body.lon ??
            body.customerLongitude ??
            body.customer_longitude
        );
        const bodyFulfillmentType = normalizeFulfillmentType(body.fulfillmentType || body.fulfillment_type);
        const pickupItem = items.find((item: any) => item.fulfillmentType === 'pickup');
        const orderFulfillmentType = pickupItem || bodyFulfillmentType === 'pickup' ? 'pickup' : 'delivery';
        const preferredBranchId =
            orderFulfillmentType === 'pickup'
                ? cleanString(body.branchId || body.branch_id || body.branch) ||
                  cleanString(pickupItem?.selectedBranchId)
                : '';
        const branchSummary = {
            id: null as string | null,
            name: null as string | null,
            slug: null as string | null,
            code: null as string | null,
            city: null as string | null,
            state: null as string | null,
        };

        let selectedBranch: any = null;

        if (itemProductIds.length > 0) {
            try {
                const [branches, inventoryRecords] = await Promise.all([
                    Branch.find({ isActive: true })
                        .select('name slug code isActive workloadScore deliveryRadiusKm address')
                        .lean(),
                    Inventory.find({ product: { $in: itemProductIds } })
                        .select('branch product quantity reservedQuantity')
                        .lean(),
                ]);

                selectedBranch = selectFulfillmentBranch({
                    branches: (branches || []).map((branch: any) => ({
                        id: String(branch._id || branch.id),
                        name: branch.name,
                        slug: branch.slug,
                        code: branch.code || null,
                        isActive: branch.isActive !== false,
                        workloadScore: Number(branch.workloadScore || 0),
                        deliveryRadiusKm: Number(branch.deliveryRadiusKm || 0) || null,
                        address: {
                            city: branch.address?.city || '',
                            state: branch.address?.state || '',
                            latitude: branch.address?.latitude ?? null,
                            longitude: branch.address?.longitude ?? null,
                        },
                    })),
                    inventoryRecords: (inventoryRecords || []).map((record: any) => ({
                        branchId: String(record.branch || ''),
                        productId: String(record.product || ''),
                        quantity: Number(record.quantity || 0),
                        reservedQuantity: Number(record.reservedQuantity || 0),
                    })),
                    items: items.map((item: any) => ({
                        productId: String(item.product_id || item.id || ''),
                        quantity: Number(item.quantity || item.qty || 1),
                    })),
                    preferredBranchId: preferredBranchId || null,
                    customerState: safeState,
                    customerCity: safeCity,
                    customerLatitude,
                    customerLongitude,
                });
            } catch (branchSelectionError) {
                console.warn('checkout: branch selection fallback to legacy stock path', branchSelectionError);
                selectedBranch = null;
            }
        }

        if (selectedBranch) {
            branchSummary.id = String(selectedBranch._id || selectedBranch.id);
            branchSummary.name = selectedBranch.name || null;
            branchSummary.slug = selectedBranch.slug || null;
            branchSummary.code = selectedBranch.code || null;
            branchSummary.city = selectedBranch.address?.city || null;
            branchSummary.state = selectedBranch.address?.state || null;
        }

        const pickupBranchId = orderFulfillmentType === 'pickup' ? branchSummary.id : null;
        const pickupBranchName =
            orderFulfillmentType === 'pickup'
                ? (branchSummary.name || cleanString(pickupItem?.selectedBranchName) || null)
                : null;

        if (!email || items.length === 0 || (!shipping_address && !customer) || !finalTotal) {
            return NextResponse.json({ success: false, error: 'Missing required order data.' }, { status: 400 });
        }

        // 1. IDEMPOTENCY CHECK
        if (idempotencyKey) {
            const existingOrder = await Order.findOne({ idempotencyKey });
            if (existingOrder) {
                return NextResponse.json({ 
                    success: true, 
                    message: 'Idempotent request. Order already exists.', 
                    order_id: existingOrder._id.toString() 
                }, { status: 200 });
            }
        }

        // 2. START ATOMIC TRANSACTION
        const session = await mongoose.startSession();
        session.startTransaction();

        let createdOrderId: string;
        const inventoryMovements: Array<{
            inventoryId: string;
            productId: string;
            branchId: string;
            quantityBefore: number;
            quantityDelta: number;
            quantityAfter: number;
            notes?: string | null;
        }> = [];

        try {
            // A. Stock Check and Decrement
            for (const item of items) {
                const pId = item.product_id || item.id;
                const itemQty = Number(item.quantity || item.qty || 1);

                const product = await Product.findById(pId).select('title name stock').session(session).lean();
                 
                if (!product || Number((product as any).stock || 0) < itemQty) {
                    const productName = (product as any)?.title || (product as any)?.name || item.name || 'An item in your cart';
                    throw new Error(`Sorry, "${productName}" only has ${Number((product as any)?.stock || 0)} left in stock.`);
                }

                if (selectedBranch) {
                    const inventoryDoc = await Inventory.findOne({ branch: branchSummary.id, product: pId }).session(session);
                    const available = Number(inventoryDoc?.quantity || 0) - Number(inventoryDoc?.reservedQuantity || 0);

                    if (!inventoryDoc || available < itemQty) {
                        const productName = (product as any).title || (product as any).name || item.name || 'An item in your cart';
                        throw new Error(`Sorry, "${productName}" is not available from the nearest fulfillment stock right now.`);
                    }

                    const quantityBefore = Number(inventoryDoc.quantity || 0);
                    const quantityAfter = quantityBefore - itemQty;
                    inventoryDoc.quantity = quantityAfter;
                    inventoryDoc.lastAdjustedBy = userId ? new mongoose.Types.ObjectId(userId) : null;
                    await inventoryDoc.save({ session });

                    inventoryMovements.push({
                        inventoryId: String(inventoryDoc._id),
                        productId: String(pId),
                        branchId: String(branchSummary.id),
                        quantityBefore,
                        quantityDelta: -itemQty,
                        quantityAfter,
                        notes: 'Checkout sale',
                    });
                }

                const stockUpdate = await Product.updateOne(
                    { _id: pId, stock: { $gte: itemQty } },
                    { $inc: { stock: -itemQty } },
                    { session }
                );

                if (stockUpdate.modifiedCount !== 1) {
                    const productName = (product as any).title || (product as any).name || item.name || 'An item in your cart';
                    throw new Error(`Sorry, "${productName}" stock changed while checking out. Please try again.`);
                }
            }

            // B. Create the Order Document
            const newOrder = new Order({
                user: userId,
                branch: selectedBranch ? branchSummary.id : null,
                branchName: selectedBranch ? branchSummary.name : null,
                fulfillmentType: orderFulfillmentType,
                pickupBranch: pickupBranchId,
                pickupBranchName,
                email,
                items: items.map((i: any) => ({ 
                    product: i.product_id || i.id, 
                    name: i.name || i.product?.name || i.product?.title || '',
                    quantity: Number(i.quantity || i.qty || 1), 
                    price: Number(i.price),
                    unit: i.selectedUnit || i.unit || null,
                    selectedColor: i.selectedColor || null,
                    selectedColorHex: i.selectedColorHex || null,
                    fulfillmentType: i.fulfillmentType || orderFulfillmentType,
                    pickupBranch: i.fulfillmentType === 'pickup' ? (i.selectedBranchId || pickupBranchId) : null,
                    pickupBranchName: i.fulfillmentType === 'pickup' ? (i.selectedBranchName || pickupBranchName) : null,
                })),
                totalAmount: finalTotal,
                shippingAddress: {
                    street: safeStreet,
                    city: safeCity,
                    state: safeState,
                    lga: safeLga,
                    phone: safePhone,
                    country: 'Nigeria'
                },
                idempotencyKey,
                paymentStatus: 'pending',
                fulfillmentStatus: 'pending',
                deliveryStatus: 'pending',
            });

            const savedOrder = await newOrder.save({ session });
            createdOrderId = savedOrder._id.toString();

            if (selectedBranch && inventoryMovements.length > 0) {
                for (const movement of inventoryMovements) {
                    await new InventoryLog({
                        inventory: movement.inventoryId,
                        product: movement.productId,
                        branch: movement.branchId,
                        action: 'sale',
                        quantityBefore: movement.quantityBefore,
                        quantityDelta: movement.quantityDelta,
                        quantityAfter: movement.quantityAfter,
                        performedBy: userId ? new mongoose.Types.ObjectId(userId) : null,
                        referenceType: 'order',
                        referenceId: createdOrderId,
                        notes: movement.notes || 'Checkout sale',
                        metadata: {
                            orderId: createdOrderId,
                            email,
                            source: 'checkout',
                        },
                    }).save({ session });
                }
            }

            // C. Commit Transaction
            await session.commitTransaction();

            const emailPayload = {
                id: createdOrderId,
                orderNumber: createdOrderId,
                order_number: createdOrderId,
                email,
                total: finalTotal,
                subtotal: computedItemsTotal,
                status: 'pending',
                shippingAddress: {
                    street: safeStreet,
                    city: safeCity,
                    lga: safeLga,
                    state: safeState,
                    phone: safePhone,
                    country: 'Nigeria',
                },
                shipping_address: `${safeStreet}, ${safeCity}${safeLga ? `, ${safeLga}` : ''}, ${safeState}`,
                customer: {
                    phone: safePhone,
                    city: safeCity,
                    state: safeState,
                    lga: safeLga,
                },
                branch: selectedBranch ? branchSummary : null,
                fulfillmentType: orderFulfillmentType,
                pickupBranch: pickupBranchId
                    ? {
                        id: pickupBranchId,
                        name: pickupBranchName,
                    }
                    : null,
            };

            await Promise.allSettled([
                sendOrderCreatedEmail(emailPayload, items),
                sendAdminOrderAlertEmail(emailPayload, items),
            ]);
        } catch (txError: any) {
            await session.abortTransaction();
            console.error("MongoDB Transaction Error:", txError.message);
            if (txError.message.includes('Sorry,')) {
                return NextResponse.json({ success: false, error: txError.message }, { status: 409 });
            }
            if (txError.message.includes('Please choose a color') || txError.message.includes('available color')) {
                return NextResponse.json({ success: false, error: txError.message }, { status: 400 });
            }
            throw txError;
        } finally {
            session.endSession();
        }

        // 3. INITIALIZE PAYSTACK
        const paystackResponse = await initializepaystack({
            email: email,
            amount: Math.round(finalTotal * 100),
            reference: createdOrderId, 
            callback_url: PAYSTACK_CALLBACK_URL,
            metadata: {
                custom_fields: [{ display_name: "Order ID", variable_name: "order_id", value: createdOrderId }]
            }
        });

        if (!paystackResponse.status) {
            console.error("Paystack Init Failed:", paystackResponse.message);
            return NextResponse.json({ 
                success: false, 
                error: 'Order created, but payment initialization failed. Stock reserved.',
                order_id: createdOrderId
            }, { status: 500 });
        }

        if (paystackResponse.data?.reference) {
            await Order.findByIdAndUpdate(createdOrderId, { paystackReference: paystackResponse.data.reference });
        }

        return NextResponse.json({
            success: true,
            message: 'Order created and payment initiated.',
            order_id: createdOrderId,
            paystack_auth_url: paystackResponse.data?.authorization_url,
            paystack_reference: paystackResponse.data?.reference,
            data: {
                order: { id: createdOrderId },
                paystack: {
                    authorization_url: paystackResponse.data?.authorization_url,
                    reference: paystackResponse.data?.reference,
                },
            },
        }, { status: 201 });

    } catch (error: any) {
        console.error("Checkout route error:", error);
        const message = String(error?.message || error || '');
        if (message.toLowerCase().includes('product not found')) {
            return NextResponse.json({ success: false, error: message }, { status: 404 });
        }
        if (message.toLowerCase().includes('missing required order data')) {
            return NextResponse.json({ success: false, error: message }, { status: 400 });
        }
        if (message.includes('Please choose a color') || message.includes('available color')) {
            return NextResponse.json({ success: false, error: message }, { status: 400 });
        }
        return NextResponse.json({ success: false, error: error.message || 'Internal server error during checkout.' }, { status: 500 });
    }
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204 });
}
