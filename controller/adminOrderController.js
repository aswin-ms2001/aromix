import Order from "../model/oder.js";
import Product from "../model/product.js";
import Wallet from "../model/wallet.js";
import User from "../model/user.js";

export const adminOrderFront = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const statusFilter = req.query.status || '';
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder || 'desc';

        // Build search and filter query
        let searchQuery = {};
        
        if (search) {
            searchQuery.$or = [
                { orderId: { $regex: search, $options: 'i' } },
                { 'address.name': { $regex: search, $options: 'i' } },
                { 'address.mobile': { $regex: search, $options: 'i' } }
            ];
        }

        if (statusFilter) {
            searchQuery.orderStatus = statusFilter;
        }

        // Get total count for pagination
        const totalOrders = await Order.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalOrders / limit);

        // Build sort object
        const sortObject = {};
        sortObject[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Get orders with pagination and populate user details
        const orders = await Order.find(searchQuery)
            .populate('userId', 'name email phoneNumber')
            .populate('items.productId', 'name images variants')
            .sort(sortObject)
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

        // Get unique statuses for filter dropdown
        const statuses = await Order.distinct('orderStatus');

        return res.render("admin-views/adminOrderManagement.ejs", {
            orders,
            currentPage: page,
            totalPages,
            totalOrders,
            search,
            statusFilter,
            sortBy,
            sortOrder,
            statuses,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1
        });

    } catch (err) {
        console.error("Error in adminOrderFront:", err);
        return res.render("error.ejs");
    }
};

export const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;

        const order = await Order.findById(orderId)
            .populate('userId', 'name email phoneNumber')
            .populate('items.productId', 'name images description variants')
            .lean();

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

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
                            order.orderStatus === 'Confirmed' ? 'primary' :
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

                    <div class="row mb-3">
                        <div class="col-md-6">
                            <small class="text-muted">Payment Status:</small>
                            <div>
                                <span class="badge bg-${
                                    order.paymentStatus === 'Paid' ? 'success' :
                                    order.paymentStatus === 'Failed' ? 'danger' :
                                    'warning'
                                }">${order.paymentStatus}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <small class="text-muted">Order Status:</small>
                            <div>
                                <select class="form-select form-select-sm" id="orderStatusSelect" onchange="updateOrderStatus('${order._id}', this.value)">
                                    <option value="Pending" ${order.orderStatus === 'Pending' ? 'selected' : ''}>Pending</option>
                                    <option value="Confirmed" ${order.orderStatus === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                                    <option value="Shipped" ${order.orderStatus === 'Shipped' ? 'selected' : ''}>Shipped</option>
                                    <option value="Out for Delivery" ${order.orderStatus === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
                                    <option value="Delivered" ${order.orderStatus === 'Delivered' ? 'selected' : ''}>Delivered</option>
                                    <option value="Cancelled" ${order.orderStatus === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <hr>

                    <h6 class="fw-bold mb-3">Customer Details</h6>
                    <div class="bg-light p-3 rounded mb-3">
                        <div><strong>Name:</strong> ${order.userId.name}</div>
                        <div><strong>Email:</strong> ${order.userId.email}</div>
                        <div><strong>Phone:</strong> ${order.userId.phoneNumber}</div>
                    </div>

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
                                    <tr data-variant-id="${item.variantId}">
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
                                            ${item.returnStatus === 'Requested' ? 
                                                `<button class="btn btn-outline-warning btn-sm" onclick="verifyReturn('${order._id}', '${item.variantId}')">
                                                    <i class="bi bi-check-circle"></i> Verify Return
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

                    ${order.items.some(item => item.cancelStatus === 'Cancelled') ? `
                        <hr>
                        <h6 class="fw-bold mb-3">Cancellation Details</h6>
                        ${order.items.map(item => item.cancelStatus === 'Cancelled' ? `
                            <div class="alert alert-danger mb-2">
                                <strong>${item.productId.name} (${item.variant ? item.variant.volume + 'ml' : 'N/A'}):</strong> Cancelled
                                ${item.cancelReason ? `<br><small class="text-muted">Reason: ${item.cancelReason}</small>` : ''}
                            </div>
                        ` : '').join('')}
                    ` : ''}

                    ${order.items.some(item => item.returnStatus !== 'Not Requested') ? `
                        <hr>
                        <h6 class="fw-bold mb-3">Return Details</h6>
                        ${order.items.map(item => item.returnStatus !== 'Not Requested' ? `
                            <div class="alert alert-info mb-2">
                                <strong>${item.productId.name} (${item.variant ? item.variant.volume + 'ml' : 'N/A'}):</strong> ${item.returnStatus}
                                ${item.returnReason ? `<br><small class="text-muted">Reason: ${item.returnReason}</small>` : ''}
                                ${item.returnRequestDate ? `<br><small class="text-muted">Requested: ${new Date(item.returnRequestDate).toLocaleDateString('en-IN')}</small>` : ''}
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

export const updateOrderStatus = async (req, res) => {
    try {
        const orderId = req.params.id;
        const newStatus = req.body.status;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Validate status progression
        const statusOrder = ["Pending", "Confirmed", "Shipped", "Out for Delivery", "Delivered"];
        const currentIndex = statusOrder.indexOf(order.orderStatus);
        const newIndex = statusOrder.indexOf(newStatus);

        if (newStatus === "Cancelled") {
            // Allow cancellation only for pending orders
            if (order.orderStatus !== "Pending") {
                return res.status(400).json({ success: false, message: "Only pending orders can be cancelled" });
            }
        } else if (newIndex === -1 || newIndex < currentIndex) {
            return res.status(400).json({ success: false, message: "Invalid status progression" });
        }
        if(order.orderStatus === "Pending" && newStatus !== "Cancelled" && newIndex - currentIndex > 1){
             return res.status(400).json({ success: false, message: "You can only Confirm or Cancel while the order is Pending " });
        }

        if(order.orderStatus === "Pending" && newStatus !== "Cancelled" && order.paymentMethod !== "COD" &&  order.paymentStatus !== "Paid"){
             return res.status(400).json({ success: false, message: "This is Not a COD and the payment isn't successfull yet " });
        }

        if(newStatus!== "Cancelled" && order.orderStatus !== "Pending" && newIndex-currentIndex >1 ){
            return res.status(400).json({ success: false, message: "Progression Should be Followed Step by step" });
        }

        // Update order status
        order.orderStatus = newStatus;

        // Update payment status when delivered
        if (newStatus === "Delivered" && order.paymentMethod === "COD") {
            order.paymentStatus = "Paid";
        }

        

        if(newStatus==="Cancelled"){
            for (let item of order.items) {
                    await Product.updateOne(
                        { _id: item.productId, "variants._id": item.variantId },
                        { $inc: { "variants.$.stock": item.quantity } }
                    );
                }

            if(order.paymentMethod !== "COD" && order.paymentStatus === "Paid"){
                // Process refund to wallet - only the specific item's total
                let wallet = await Wallet.findOne({ userId: order.userId });
                if (!wallet) {
                    wallet = new Wallet({ userId: order.userId, balance: 0 });
                }

                const refundAmount = order.grandTotal; // This is already item.total (price * quantity)
                wallet.balance += refundAmount;
                wallet.transactions.push({
                    type: "Credit",
                    amount: refundAmount,
                    description: `Refund for Admin Cancelled Order  - Order #${order.orderId}`,
                    orderId: order._id
                });

                await wallet.save();
            }        
        }
 
        await order.save();

        res.json({ success: true, message: "Order status updated successfully" });

    } catch (err) {
        console.error("Error in updateOrderStatus:", err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

export const verifyReturn = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const variantId = req.params.variantId;
        const { action } = req.body; // action: 'approve' or 'reject'

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.orderStatus !== "Delivered") {
            return res.status(400).json({ success: false, message: "Returns can only be processed for delivered orders" });
        }

        // Find the specific item
        const itemToReturn = order.items.find(item => item.variantId.toString() === variantId);
        if (!itemToReturn) {
            return res.status(404).json({ success: false, message: "Order item not found" });
        }

        if (itemToReturn.returnStatus !== "Requested") {
            return res.status(400).json({ success: false, message: "Item is not in requested status" });
        }

        if (action === "approve") {
            // Approve return
            itemToReturn.returnStatus = "Approved";
            
            // Process refund to wallet - only the specific item's total
            let wallet = await Wallet.findOne({ userId: order.userId });
            if (!wallet) {
                wallet = new Wallet({ userId: order.userId, balance: 0 });
            }

            const refundAmount = itemToReturn.total; // This is already item.total (price * quantity)
            wallet.balance += refundAmount;
            wallet.transactions.push({
                type: "Credit",
                amount: refundAmount,
                description: `Refund for returned item  - Order #${order.orderId}`,
                orderId: order._id
            });

            await wallet.save();
            await order.save();
            // Restore stock for the specific item
            await Product.updateOne(
                { _id: itemToReturn.productId, "variants._id": itemToReturn.variantId },
                { $inc: { "variants.$.stock": itemToReturn.quantity } }
            );

            res.json({ 
                success: true, 
                message: "Return approved and refund processed",
                refundAmount
            });

        } else if (action === "reject") {
            // Reject return
            itemToReturn.returnStatus = "Rejected";
            await order.save();

            res.json({ success: true, message: "Return request rejected" });
        } else {
            return res.status(400).json({ success: false, message: "Invalid action" });
        }

    } catch (err) {
        console.error("Error in verifyReturn:", err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};