import express from "express";
import Cart from "../model/cart.js";
import Product from "../model/product.js";
import Address from "../model/address.js";
import Order from "../model/oder.js";
import mongoose, { Mongoose } from "mongoose";
import { productDetails } from "./adminController.js";
import { isProductAndCategoryActive ,getVariantStock } from "./services/userServices/productActivityCheckingService.js";
import * as cartService from "./services/userServices/cartServices.js";
import currentUser from "../middleware/userIdentification/currentUser.js";
import PDFDocument from "pdfkit";

export const userCheckOut = async (req,res)=>{
    try {
        const userId = req.user._id;
        const {cartItems,subtotal} = await cartService.getUserCartFunction(userId);
        if(!cartItems[0]) return res.redirect("/users-cart/user-cart-front")
        const addresses = await Address.find({userId}).sort({isDefault:-1,createdAt:-1}).lean();
        const defaultAddress = addresses.find(addr => addr.isDefault)|| null;
        return res.render("user-views/user-checkout/checkout.ejs",{
            cart:cartItems,
            subtotal,
            addresses,
            defaultAddress
        })
    } catch(err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
}

export const userOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { cart, selectedAddressId, paymentMethod } = req.body;

    // 1. Validate payment method
    if (paymentMethod !== "cod") {
      return res.status(400).json({ success: false, message: "Only Cash On Delivery is Applicable" });
    }

    // 2. Validate address
    const address = await Address.findById(selectedAddressId);
    if (!address) {
      return res.status(404).json({ success: false, message: "Address Not Found" });
    }

   
    const { cartItems, subtotal } = await cartService.getUserCartFunction(userId);
    if (!cartItems.length) {
      return res.status(400).json({ success: false, message: "Cart is Empty" });
    }

    // 4. Validate user cart IDs vs DB cart IDs
    const userVariantIds = cart.map(item => String(item.variant._id)).sort();
    const dbVariantIds = cartItems.map(item => String(item.variant._id)).sort();

    const allMatch =
      userVariantIds.length === dbVariantIds.length &&
      userVariantIds.every((id, index) => id === dbVariantIds[index]);

    if (!allMatch) {
      return res.status(400).json({ success: false, message: "Admin modified your cart items. Please refresh your cart." });
    }

    // 5. Check stock availability
    const outOfStockItems = [];
    for (let item of cartItems) {
      const stock = await getVariantStock(item.productId._id, item.variant._id);
      if (stock < item.quantity) {
        outOfStockItems.push(`${item.productId.name} (${item.variant.volume}ml)`);
      }
    }

    if (outOfStockItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Some items are out of stock",
        outOfStockItems
      });
    }

    // 6. Prepare Order Items
    const orderItems = cartItems.map(item => ({
      productId: item.productId._id,
      variantId: item.variant._id,
      quantity: item.quantity,
      basePrice: item.variant.price,
      discountAmount: 0, // If any discounts
      finalPrice: item.variant.price, // No discount applied
      total: item.variant.price * item.quantity,
      appliedOffer: null
    }));

    // 7. Calculate totals
    const discount = 0; // Apply coupon logic if needed
    const shippingCharge = subtotal >1000 ? 0 :  50; // Add shipping logic if needed
    const grandTotal = subtotal - discount + shippingCharge;

    // 8. Create Order
    const order = new Order({
      userId,
      items: orderItems,
      address: {
        name: address.name,
        house: address.house,
        street: address.street,
        city: address.city,
        state: address.state,
        country: address.country,
        pincode: address.pincode,
        mobile: address.mobile
      },
      paymentMethod: "COD",
      paymentStatus: "Pending",
      orderStatus: "Pending",
      subtotal,
      discount,
      shippingCharge,
      grandTotal,
      appliedCoupon: null
    });

    await order.save();

    // 9. Reduce stock for each variant
    for (let item of cartItems) {
      await Product.updateOne(
        { _id: item.productId._id, "variants._id": item.variant._id },
        { $inc: { "variants.$.stock": -item.quantity } }
      );
    }

    // 10. Clear user cart
    await Cart.deleteMany({userId});

    return res.status(200).json({
      success: true,
      message: "Order placed successfully",
      orderId: order._id,
      redirect:`/user-oder/oder-status/${order._id}`
    });

  } catch (err) {
    console.error("Error in userOrder:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const userOrderSuccessPage = async (req,res)=>{
    try{
        const id = req.params.id;
        const order = await Order.findById(id); 
        if(!order || String(order.userId) !== String(req.user._id)) {
            return res.render("error.ejs");
        }
        return res.render("user-views/user-account/user-profile/user-success.ejs",{
            order
        })
    }catch(err){
        console.log(err);
        return res.render("error.ejs")
    }
}

export const orderFrontPage = async (req,res)=>{
    try{
        const userId = req.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';

        // Build search query
        let searchQuery = { userId };
        if (search) {
            searchQuery.orderId = { $regex: search, $options: 'i' };
        }

        // Get total count for pagination
        const totalOrders = await Order.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalOrders / limit);

        // Get orders with pagination and populate product details
        const orders = await Order.find(searchQuery)
            .populate('items.productId', 'name images variants')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Add variant details to each item
        orders.forEach(order => {
            order.items.forEach(item => {
                if (item.productId && item.productId.variants) {
                    const variant = item.productId.variants.find(v => v._id.toString() === item.variantId.toString());
                    if (variant) {
                        item.variant = variant;
                    }
                }
            });
        });

        return res.render("user-views/user-account/user-profile/user-order.ejs",{
            orders,
            currentPage: page,
            totalPages,
            totalOrders,
            search,
            activePage: "order",
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1,
            currentUser: req.user
        });

    }catch(err){
        console.log(err);
        return res.render("error.ejs");
    }
}

export const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.user._id;

        const order = await Order.findOne({ _id: orderId, userId })
            .populate('items.productId', 'name images description variants')
            .lean();

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        console.log(order.items[0].productId.variants);
        // Add variant details to each item
        order.items.forEach(item => {
            if (item.productId && item.productId.variants) {
                const variant = item.productId.variants.find(v => v._id.toString() === item.variantId.toString());
                if (variant) {
                    item.variant = variant;
                }
            }
        });

        // Generate HTML for order details modal
        const html = `
            <div class="row">
                <div class="col-12">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h6 class="fw-bold">Order #${order.orderId}</h6>
                        <span class="badge bg-${
                            order.orderStatus === 'Delivered' ? 'success' :
                            order.orderStatus === 'Cancelled' ? 'danger' :
                            order.orderStatus === 'Shipped' ? 'info' :
                            order.orderStatus === 'Out for Delivery' ? 'warning' :
                            'secondary'
                        }">${order.orderStatus}</span>
                    </div>
                    
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <small class="text-muted">Order Date:</small>
                            <div>${new Date(order.createdAt).toLocaleDateString('en-IN', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}</div>
                        </div>
                        <div class="col-md-6">
                            <small class="text-muted">Payment Method:</small>
                            <div>${order.paymentMethod}</div>
                        </div>
                    </div>

                    <hr>

                    <h6 class="fw-bold mb-3">Shipping Address</h6>
                    <div class="bg-light p-3 rounded mb-3">
                        <div>${order.address.name}</div>
                        <div>${order.address.house}, ${order.address.street}</div>
                        <div>${order.address.city}, ${order.address.state} - ${order.address.pincode}</div>
                        <div>${order.address.country}</div>
                        <div>Phone: ${order.address.mobile}</div>
                    </div>

                    <h6 class="fw-bold mb-3">Order Items</h6>
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead class="table-light">
                                <tr>
                                    <th>Product</th>
                                    <th class="text-center">Volume</th>
                                    <th class="text-center">Quantity</th>
                                    <th class="text-end">Price</th>
                                    <th class="text-end">Total</th>
                                    <th class="text-center">Status</th>
                                    <th class="text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${order.items.map(item => `
                                    <tr>
                                        <td>
                                            <div class="d-flex align-items-center">
                                                <img src="${item.variant && item.variant.images && item.variant.images.length > 0 ? item.variant.images[0] : '/images/no-image.png'}" 
                                                     alt="${item.productId.name}" 
                                                     class="rounded me-2" style="width: 40px; height: 40px; object-fit: cover;">
                                                <div>
                                                    <div class="fw-bold">${item.productId.name}</div>
                                                    <small class="text-muted">₹${item.finalPrice} each</small>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="text-center">${item.variant ? item.variant.volume + 'ml' : 'N/A'}</td>
                                        <td class="text-center">${item.quantity}</td>
                                        <td class="text-end">₹${item.finalPrice}</td>
                                        <td class="text-end">₹${item.total}</td>
                                        <td class="text-center">
                                            ${item.cancelStatus === 'Cancelled' ? 
                                                '<span class="badge bg-danger">Cancelled</span>' :
                                                item.returnStatus === 'Requested' ? 
                                                '<span class="badge bg-warning">Return Requested</span>' :
                                                item.returnStatus === 'Approved' ? 
                                                '<span class="badge bg-info">Return Approved</span>' :
                                                item.returnStatus === 'Returned' ? 
                                                '<span class="badge bg-success">Returned</span>' :
                                                '<span class="badge bg-secondary">Active</span>'
                                            }
                                        </td>
                                        <td class="text-center">
                                            ${item.cancelStatus !== 'Cancelled' && order.orderStatus === 'Pending' ? 
                                                `<button class="btn btn-outline-danger btn-sm" onclick="cancelOrderItem('${order._id}', '${item.variantId}')">
                                                    <i class="bi bi-x-circle"></i> Cancel
                                                </button>` : ''
                                            }
                                            ${item.cancelStatus !== 'Cancelled' && order.orderStatus === 'Delivered' && item.returnStatus === 'Not Requested' ? 
                                                `<button class="btn btn-outline-warning btn-sm" onclick="requestReturn('${order._id}', '${item.variantId}')">
                                                    <i class="bi bi-arrow-return-left"></i> Request Return
                                                </button>` : ''
                                            }
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div class="row justify-content-end">
                        <div class="col-md-4">
                            <div class="d-flex justify-content-between mb-1">
                                <span>Subtotal:</span>
                                <span>₹${order.subtotal}</span>
                            </div>
                            <div class="d-flex justify-content-between mb-1">
                                <span>Shipping:</span>
                                <span>₹${order.shippingCharge}</span>
                            </div>
                            ${order.discount > 0 ? `
                                <div class="d-flex justify-content-between mb-1">
                                    <span>Discount:</span>
                                    <span class="text-success">-₹${order.discount}</span>
                                </div>
                            ` : ''}
                            <hr>
                            <div class="d-flex justify-content-between fw-bold">
                                <span>Total:</span>
                                <span>₹${order.grandTotal}</span>
                            </div>
                        </div>
                    </div>

                    ${order.items.some(item => item.returnStatus !== 'Not Requested') ? `
                        <hr>
                        <h6 class="fw-bold mb-3">Return Status</h6>
                        ${order.items.map(item => item.returnStatus !== 'Not Requested' ? `
                            <div class="alert alert-info mb-2">
                                <strong>${item.productId.name} (${item.variant ? item.variant.volume + 'ml' : 'N/A'}):</strong> ${item.returnStatus}
                                ${item.returnReason ? `<br><small class="text-muted">Reason: ${item.returnReason}</small>` : ''}
                            </div>
                        ` : '').join('')}
                    ` : ''}
                </div>
            </div>
        `;

        res.json({ success: true, html });

    } catch (err) {
        console.error("Error in getOrderDetails:", err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

export const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.user._id;
        const { reason } = req.body;

        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({ success: false, message: "Cancellation reason is required" });
        }

        const order = await Order.findOne({ _id: orderId, userId });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.orderStatus !== 'Pending') {
            return res.status(400).json({ success: false, message: "Only pending orders can be cancelled" });
        }

        // Update order status and add cancellation details
        order.orderStatus = 'Cancelled';
        order.items.forEach(item => {
            item.cancelStatus = 'Cancelled';
            item.cancelReason = reason;
        });

        await order.save();

        // Restore stock for cancelled items
        for (let item of order.items) {
            await Product.updateOne(
                { _id: item.productId, "variants._id": item.variantId },
                { $inc: { "variants.$.stock": item.quantity } }
            );
        }

        res.json({ success: true, message: "Order cancelled successfully" });

    } catch (err) {
        console.error("Error in cancelOrder:", err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

export const cancelOrderItem = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const variantId = req.params.variantId;
        const userId = req.user._id;
        const { reason } = req.body;

        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({ success: false, message: "Cancellation reason is required" });
        }

        const order = await Order.findOne({ _id: orderId, userId });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.orderStatus !== 'Pending') {
            return res.status(400).json({ success: false, message: "Only pending orders can have items cancelled" });
        }

        // Find the specific item to cancel
        const itemToCancel = order.items.find(item => item.variantId.toString() === variantId);
        
        if (!itemToCancel) {
            return res.status(404).json({ success: false, message: "Order item not found" });
        }

        if (itemToCancel.cancelStatus === 'Cancelled') {
            return res.status(400).json({ success: false, message: "Item is already cancelled" });
        }

        // Cancel the specific item
        itemToCancel.cancelStatus = 'Cancelled';
        itemToCancel.cancelReason = reason;

        // Recalculate order totals
        let newSubtotal = 0;
        let activeItemsCount = 0;
        
        order.items.forEach(item => {
            if (item.cancelStatus !== 'Cancelled') {
                newSubtotal += item.total;
                activeItemsCount++;
            }
        });

        // Update order totals
        order.subtotal = newSubtotal;
        order.shippingCharge = newSubtotal > 1000 ? 0 : 50;
        order.grandTotal = newSubtotal + order.shippingCharge - order.discount;

        // If all items are cancelled, cancel the entire order
        if (activeItemsCount === 0) {
            order.orderStatus = 'Cancelled';
        }

        await order.save();

        // Restore stock for the cancelled item
        await Product.updateOne(
            { _id: itemToCancel.productId, "variants._id": itemToCancel.variantId },
            { $inc: { "variants.$.stock": itemToCancel.quantity } }
        );

        res.json({ 
            success: true, 
            message: "Item cancelled successfully",
            orderCancelled: activeItemsCount === 0
        });

    } catch (err) {
        console.error("Error in cancelOrderItem:", err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

export const requestReturn = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const variantId = req.params.variantId;
        const userId = req.user._id;
        const { reason } = req.body;

        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({ success: false, message: "Return reason is required" });
        }

        const order = await Order.findOne({ _id: orderId, userId });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.orderStatus !== 'Delivered') {
            return res.status(400).json({ success: false, message: "Only delivered orders can be returned" });
        }

        // Find the specific item to return
        const itemToReturn = order.items.find(item => item.variantId.toString() === variantId);
        
        if (!itemToReturn) {
            return res.status(404).json({ success: false, message: "Order item not found" });
        }

        if (itemToReturn.cancelStatus === 'Cancelled') {
            return res.status(400).json({ success: false, message: "Cancelled items cannot be returned" });
        }

        if (itemToReturn.returnStatus !== 'Not Requested') {
            return res.status(400).json({ success: false, message: "Return request already exists for this item" });
        }

        // Update only the specific item with return request
        itemToReturn.returnStatus = 'Requested';
        itemToReturn.returnReason = reason;
        itemToReturn.returnRequestDate = new Date();

        await order.save();

        res.json({ success: true, message: "Return request submitted successfully" });

    } catch (err) {
        console.error("Error in requestReturn:", err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

export const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.user._id;

        const order = await Order.findOne({ _id: orderId, userId })
            .populate('items.productId', 'name images')
            .lean();

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.orderStatus !== 'Delivered') {
            return res.status(400).json({ success: false, message: "Invoice can only be downloaded for delivered orders" });
        }

        // Create PDF document
        const doc = new PDFDocument({ margin: 50 });
        
        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
        
        // Pipe PDF to response
        doc.pipe(res);

        // Add company header
        doc.fontSize(24).font('Helvetica-Bold').text('AROMIX', { align: 'center' });
        doc.fontSize(12).font('Helvetica').text('Fragrance Store', { align: 'center' });
        doc.moveDown();

        // Add invoice title
        doc.fontSize(18).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
        doc.moveDown();

        // Order details
        doc.fontSize(12).font('Helvetica-Bold').text('Order Details:');
        doc.fontSize(10).font('Helvetica').text(`Order ID: ${order.orderId}`);
        doc.fontSize(10).font('Helvetica').text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`);
        doc.fontSize(10).font('Helvetica').text(`Payment Method: ${order.paymentMethod}`);
        doc.fontSize(10).font('Helvetica').text(`Payment Status: ${order.paymentStatus}`);
        doc.moveDown();

        // Customer details
        doc.fontSize(12).font('Helvetica-Bold').text('Customer Details:');
        doc.fontSize(10).font('Helvetica').text(`Name: ${order.address.name}`);
        doc.fontSize(10).font('Helvetica').text(`Address: ${order.address.house}, ${order.address.street}`);
        doc.fontSize(10).font('Helvetica').text(`City: ${order.address.city}, ${order.address.state} - ${order.address.pincode}`);
        doc.fontSize(10).font('Helvetica').text(`Country: ${order.address.country}`);
        doc.fontSize(10).font('Helvetica').text(`Phone: ${order.address.mobile}`);
        doc.moveDown();

        // Items table header
        doc.fontSize(12).font('Helvetica-Bold').text('Order Items:');
        doc.moveDown();

        // Table headers
        const tableTop = doc.y;
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Product', 50, tableTop);
        doc.text('Qty', 300, tableTop);
        doc.text('Price', 350, tableTop);
        doc.text('Total', 420, tableTop);

        // Table content
        let yPosition = tableTop + 20;
        doc.fontSize(10).font('Helvetica');

        order.items.forEach((item, index) => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            doc.text(item.productId.name, 50, yPosition);
            doc.text(item.quantity.toString(), 300, yPosition);
            doc.text(`₹${item.finalPrice}`, 350, yPosition);
            doc.text(`₹${item.total}`, 420, yPosition);
            yPosition += 20;
        });

        doc.moveDown(2);

        // Order summary
        doc.fontSize(12).font('Helvetica-Bold').text('Order Summary:');
        doc.fontSize(10).font('Helvetica');
        doc.text(`Subtotal: ₹${order.subtotal}`, { align: 'right' });
        doc.text(`Shipping: ₹${order.shippingCharge}`, { align: 'right' });
        if (order.discount > 0) {
            doc.text(`Discount: -₹${order.discount}`, { align: 'right' });
        }
        doc.moveDown();
        doc.fontSize(14).font('Helvetica-Bold').text(`Grand Total: ₹${order.grandTotal}`, { align: 'right' });

        doc.moveDown(2);
        doc.fontSize(10).font('Helvetica').text('Thank you for your purchase!', { align: 'center' });
        doc.fontSize(8).font('Helvetica').text('For any queries, please contact our customer support.', { align: 'center' });

        // Finalize PDF
        doc.end();

    } catch (err) {
        console.error("Error in downloadInvoice:", err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};