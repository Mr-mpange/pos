const { createClient } = require('@supabase/supabase-js');

// Supabase configuration - using the same credentials as market-connect
const SUPABASE_URL = 'https://rfxpkuzizwlxfhabtnzg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmeHBrdXppendseGZoYWJ0bnpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MDE4MjgsImV4cCI6MjA4NTM3NzgyOH0.kKKmOd_6ErCh5Y7FOJ_iXDEhX_nSQIt9r6WaNXoRs7M';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false, // POS doesn't need persistent sessions
    autoRefreshToken: false
  }
});

class SupabaseService {
  
  // Get all products with vendor and category information
  static async getProducts(categoryName = null, region = null) {
    try {
      let query = supabase
        .from('products')
        .select(`
          *,
          vendors (
            id,
            business_name,
            owner_name,
            phone,
            market_location,
            region,
            trust_score,
            is_verified
          ),
          categories (
            id,
            name,
            icon
          )
        `)
        .eq('is_active', true)
        .gt('stock', 0); // Only show products in stock

      // Filter by category if specified
      if (categoryName) {
        query = query.eq('categories.name', categoryName);
      }

      // Filter by region if specified
      if (region) {
        query = query.eq('vendors.region', region);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('[Supabase] Error fetching products:', error);
        return { success: false, error: error.message };
      }

      // Transform data to match POS format
      const products = data.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: parseFloat(product.price),
        unit: product.unit,
        stock: product.stock,
        grade: product.grade,
        category: product.categories.name,
        categoryIcon: product.categories.icon,
        vendorId: product.vendor_id,
        vendorName: product.vendors.business_name,
        vendorPhone: product.vendors.phone,
        vendorLocation: product.vendors.market_location,
        region: product.vendors.region,
        trustScore: product.vendors.trust_score,
        isVerified: product.vendors.is_verified
      }));

      return { success: true, data: products };

    } catch (error) {
      console.error('[Supabase] Error in getProducts:', error);
      return { success: false, error: error.message };
    }
  }

  // Search products by name or description
  static async searchProducts(query, region = null) {
    try {
      let searchQuery = supabase
        .from('products')
        .select(`
          *,
          vendors (
            id,
            business_name,
            owner_name,
            phone,
            market_location,
            region,
            trust_score,
            is_verified
          ),
          categories (
            id,
            name,
            icon
          )
        `)
        .eq('is_active', true)
        .gt('stock', 0)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`);

      // Filter by region if specified
      if (region) {
        searchQuery = searchQuery.eq('vendors.region', region);
      }

      const { data, error } = await searchQuery.order('created_at', { ascending: false });

      if (error) {
        console.error('[Supabase] Error searching products:', error);
        return { success: false, error: error.message };
      }

      // Transform data to match POS format
      const products = data.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: parseFloat(product.price),
        unit: product.unit,
        stock: product.stock,
        grade: product.grade,
        category: product.categories.name,
        categoryIcon: product.categories.icon,
        vendorId: product.vendor_id,
        vendorName: product.vendors.business_name,
        vendorPhone: product.vendors.phone,
        vendorLocation: product.vendors.market_location,
        region: product.vendors.region,
        trustScore: product.vendors.trust_score,
        isVerified: product.vendors.is_verified
      }));

      return { success: true, data: products };

    } catch (error) {
      console.error('[Supabase] Error in searchProducts:', error);
      return { success: false, error: error.message };
    }
  }

  // Get single product by ID
  static async getProduct(productId) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          vendors (
            id,
            business_name,
            owner_name,
            phone,
            market_location,
            region,
            trust_score,
            is_verified
          ),
          categories (
            id,
            name,
            icon
          )
        `)
        .eq('id', productId)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('[Supabase] Error fetching product:', error);
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'Product not found' };
      }

      // Transform data to match POS format
      const product = {
        id: data.id,
        name: data.name,
        description: data.description,
        price: parseFloat(data.price),
        unit: data.unit,
        stock: data.stock,
        grade: data.grade,
        category: data.categories.name,
        categoryIcon: data.categories.icon,
        vendorId: data.vendor_id,
        vendorName: data.vendors.business_name,
        vendorPhone: data.vendors.phone,
        vendorLocation: data.vendors.market_location,
        region: data.vendors.region,
        trustScore: data.vendors.trust_score,
        isVerified: data.vendors.is_verified
      };

      return { success: true, data: product };

    } catch (error) {
      console.error('[Supabase] Error in getProduct:', error);
      return { success: false, error: error.message };
    }
  }

  // Get all categories
  static async getCategories() {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) {
        console.error('[Supabase] Error fetching categories:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };

    } catch (error) {
      console.error('[Supabase] Error in getCategories:', error);
      return { success: false, error: error.message };
    }
  }

  // Get all vendors
  static async getVendors(region = null) {
    try {
      let query = supabase
        .from('vendors')
        .select('*')
        .eq('is_verified', true);

      // Filter by region if specified
      if (region) {
        query = query.eq('region', region);
      }

      const { data, error } = await query.order('trust_score', { ascending: false });

      if (error) {
        console.error('[Supabase] Error fetching vendors:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };

    } catch (error) {
      console.error('[Supabase] Error in getVendors:', error);
      return { success: false, error: error.message };
    }
  }

  // Create order in the database
  static async createOrder(orderData) {
    try {
      // Create the order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          vendor_id: orderData.vendorId,
          customer_name: orderData.customerName,
          customer_phone: orderData.customerPhone,
          customer_location: orderData.customerLocation,
          total_amount: orderData.totalAmount,
          notes: orderData.notes,
          status: 'pending'
        })
        .select()
        .single();

      if (orderError) {
        console.error('[Supabase] Error creating order:', orderError);
        return { success: false, error: orderError.message };
      }

      // Create order items
      const orderItems = orderData.items.map(item => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('[Supabase] Error creating order items:', itemsError);
        // Try to rollback the order
        await supabase.from('orders').delete().eq('id', order.id);
        return { success: false, error: itemsError.message };
      }

      return { success: true, data: order };

    } catch (error) {
      console.error('[Supabase] Error in createOrder:', error);
      return { success: false, error: error.message };
    }
  }

  // Update product stock after successful purchase
  static async updateProductStock(productId, quantityPurchased) {
    try {
      // First get current stock
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('stock')
        .eq('id', productId)
        .single();

      if (fetchError) {
        console.error('[Supabase] Error fetching product stock:', fetchError);
        return { success: false, error: fetchError.message };
      }

      const newStock = product.stock - quantityPurchased;

      // Update stock
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', productId);

      if (updateError) {
        console.error('[Supabase] Error updating product stock:', updateError);
        return { success: false, error: updateError.message };
      }

      return { success: true, newStock };

    } catch (error) {
      console.error('[Supabase] Error in updateProductStock:', error);
      return { success: false, error: error.message };
    }
  }

  // Update order status
  static async updateOrderStatus(orderId, status) {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        console.error('[Supabase] Error updating order status:', error);
        return { success: false, error: error.message };
      }

      return { success: true };

    } catch (error) {
      console.error('[Supabase] Error in updateOrderStatus:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = SupabaseService;