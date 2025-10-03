// modals.js - Enhanced modal management with proper flow integration

class ModalManager {
    constructor() {
        this.currentContext = null;
        this.pendingNotification = null;
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }
        
        this.checkPendingNotification();
    }

    setupEventListeners() {
        this.setupImageUploads();
        this.setupCharacterCounter();
        this.setupScheduleOptions();
        this.setupTimeSuggestions();
        this.setupLivePreview();
        this.setupEventPromotionSelector();
        this.connectToManagers();
    }

    // ==================== PROMOTION MODAL ====================
    
    async openPromotionModal(promotion = null) {
        const modal = document.getElementById('promotion-modal');
        if (!modal) {
            console.error('Promotion modal not found');
            return;
        }

        const form = document.getElementById('promotion-form');
        const title = document.getElementById('promotion-modal-title');
        const saveBtn = document.getElementById('promotion-save-text');
        
        // Load loyalty cards first
        await this.loadLoyaltyCardsForPromotionModal();
        
        // Reset form
        form.reset();
        document.getElementById('promotion-id').value = '';
        const preview = document.getElementById('promotion-image-preview');
        const placeholder = document.querySelector('#promotion-image-upload .upload-placeholder');
        
        if (preview) preview.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
        
        if (promotion) {
            // Edit mode
            title.textContent = 'Edit Promotion';
            saveBtn.textContent = 'Update Promotion';
            this.fillPromotionForm(promotion);
        } else {
            // Create mode
            title.textContent = 'Create Promotion';
            saveBtn.textContent = 'Create Promotion';
            document.getElementById('promotion-start-date').value = new Date().toISOString().split('T')[0];
            
            // Pre-select first loyalty card if only one exists
            const cardSelector = document.getElementById('promotion-loyalty-card');
            if (cardSelector && cardSelector.options.length === 2) {
                cardSelector.selectedIndex = 1;
            }
        }
        
        // Show modal
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    }

    async loadLoyaltyCardsForPromotionModal() {
        const selector = document.getElementById('promotion-loyalty-card');
        if (!selector) return;
        
        try {
            // Get restaurant from session first
            const restaurant = JSON.parse(sessionStorage.getItem('restaurant') || '{}');
            if (!restaurant.id) {
                console.error('No restaurant ID in session');
                selector.innerHTML = '<option value="">No restaurant found - please refresh</option>';
                return;
            }
            
            // Fetch loyalty cards directly using restaurant ID from session
            const { data: loyaltyCards, error } = await supabase
                .from('loyalty_cards')
                .select('*')
                .eq('restaurant_id', restaurant.id)
                .eq('is_active', true)
                .is('deleted_at', null)
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Error fetching loyalty cards:', error);
                selector.innerHTML = '<option value="">Error loading cards</option>';
                return;
            }
            
            // Build options
            let html = '<option value="">-- Select a location --</option>';
            
            if (loyaltyCards && loyaltyCards.length > 0) {
                loyaltyCards.forEach(card => {
                    const locationStr = card.location_name || restaurant.location || 'Main Location';
                    const status = card.campaign_status === 'live' ? '🟢' : '📝';
                    html += `<option value="${card.id}" data-restaurant-id="${restaurant.id}">
                        ${status} ${card.display_name || 'Loyalty Card'} - ${locationStr}
                    </option>`;
                });
            } else {
                html += '<option value="">No active loyalty cards found</option>';
            }
            
            selector.innerHTML = html;
            
        } catch (error) {
            console.error('Error loading loyalty cards:', error);
            selector.innerHTML = '<option value="">Error loading cards</option>';
        }
    }

    fillPromotionForm(promotion) {
        document.getElementById('promotion-id').value = promotion.id;
        document.getElementById('promotion-title').value = promotion.title || '';
        document.getElementById('promotion-description').value = promotion.description || '';
        document.getElementById('promotion-start-date').value = promotion.start_date || '';
        document.getElementById('promotion-end-date').value = promotion.end_date || '';
        document.getElementById('promotion-time').value = promotion.time_restrictions || '';
        document.getElementById('promotion-status').value = promotion.status || 'draft';
        
        // Set loyalty card if exists
        if (promotion.loyalty_card_id) {
            document.getElementById('promotion-loyalty-card').value = promotion.loyalty_card_id;
        }
        
        // Set recurring days
        if (promotion.recurring_days) {
            promotion.recurring_days.forEach(day => {
                const checkbox = document.querySelector(`input[name="recurring_days"][value="${day}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
        
        // Show image if exists
        if (promotion.image_url) {
            const preview = document.getElementById('promotion-image-preview');
            const placeholder = document.querySelector('#promotion-image-upload .upload-placeholder');
            if (preview) {
                preview.src = promotion.image_url;
                preview.style.display = 'block';
            }
            if (placeholder) placeholder.style.display = 'none';
        }
    }

    closePromotionModal() {
        const modal = document.getElementById('promotion-modal');
        if (!modal) return;
        
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    }

// Replace the savePromotion method in modals.js with this version:

async savePromotion() {
    const form = document.getElementById('promotion-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const id = document.getElementById('promotion-id').value;
    const loyaltyCardId = document.getElementById('promotion-loyalty-card').value;
    
    console.log('Starting savePromotion with loyalty_card_id:', loyaltyCardId);
    
    if (!loyaltyCardId) {
        alert('Please select a location/loyalty card for this promotion');
        return;
    }
    
    const selectedOption = document.querySelector(`#promotion-loyalty-card option[value="${loyaltyCardId}"]`);
    const restaurantId = selectedOption ? selectedOption.dataset.restaurantId : null;
    
    if (!restaurantId) {
        alert('Invalid location selected');
        return;
    }
    
    const recurringDays = Array.from(document.querySelectorAll('input[name="recurring_days"]:checked'))
        .map(cb => cb.value);
    
    if (recurringDays.length === 0) {
        alert('Please select at least one active day');
        return;
    }
    
    const promotionData = {
        title: document.getElementById('promotion-title').value,
        description: document.getElementById('promotion-description').value,
        start_date: document.getElementById('promotion-start-date').value,
        end_date: document.getElementById('promotion-end-date').value || null,
        recurring_days: recurringDays,
        time_restrictions: document.getElementById('promotion-time').value || null,
        status: document.getElementById('promotion-status').value,
        restaurant_id: restaurantId,
        loyalty_card_id: loyaltyCardId
    };
    
    // FETCH LOYALTY CARD LOCATION DATA BEFORE SAVING
    console.log('Fetching loyalty card data for ID:', loyaltyCardId);
    try {
        const { data: loyaltyCard, error: cardError } = await supabase
            .from('loyalty_cards')
            .select('location_address, location_latitude, location_longitude, location_name, display_name')
            .eq('id', loyaltyCardId)
            .single();
        
        console.log('Loyalty card fetch result:', loyaltyCard, 'Error:', cardError);
        
        if (!cardError && loyaltyCard) {
            promotionData.location_address = loyaltyCard.location_address;
            promotionData.location_latitude = loyaltyCard.location_latitude;
            promotionData.location_longitude = loyaltyCard.location_longitude;
            promotionData.location_name = loyaltyCard.location_name || loyaltyCard.display_name;
            console.log('Added location data to promotion:', {
                address: promotionData.location_address,
                lat: promotionData.location_latitude,
                lng: promotionData.location_longitude,
                name: promotionData.location_name
            });
        } else {
            console.warn('Could not fetch loyalty card data:', cardError);
        }
    } catch (error) {
        console.error('Error fetching loyalty card:', error);
    }
    
    console.log('Final promotion data before save:', promotionData);
    
    try {
        let result;
        let error;
        
        if (id) {
            // Update existing promotion
            ({ data: result, error } = await supabase
                .from('promotions')
                .update({
                    ...promotionData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select());
        } else {
            // Create new promotion
            ({ data: result, error } = await supabase
                .from('promotions')
                .insert([{
                    ...promotionData,
                    created_at: new Date().toISOString(),
                    view_count: 0,
                    save_count: 0
                }])
                .select());
        }
        
        if (error) throw error;
        console.log('Promotion saved successfully:', result);
        
        this.closePromotionModal();
        
        if (window.promotionsManager) {
            window.promotionsManager.loadPromotions();
        }
        
        this.showSuccessWithNotificationPrompt({
            type: 'promotion',
            data: result[0],
            message: id ? 'Promotion updated successfully!' : 'Promotion created successfully!'
        });
        
    } catch (error) {
        console.error('Error saving promotion:', error);
        alert('Error saving promotion. Please try again.');
    }
}

    // ==================== EVENT MODAL ====================
    
    async openEventModal(event = null) {
        const modal = document.getElementById('event-modal');
        if (!modal) {
            console.error('Event modal not found');
            return;
        }

        const form = document.getElementById('event-form');
        const title = document.getElementById('event-modal-title');
        const saveBtn = document.getElementById('event-save-text');
        
        await this.loadLoyaltyCardsForEventModal();
        
        form.reset();
        document.getElementById('event-id').value = '';
        const preview = document.getElementById('event-image-preview');
        const placeholder = document.querySelector('#event-image-upload .upload-placeholder');
        
        if (preview) preview.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
        
        if (event) {
            title.textContent = 'Edit Event';
            saveBtn.textContent = 'Update Event';
            this.fillEventForm(event);
        } else {
            title.textContent = 'Create Event';
            saveBtn.textContent = 'Create Event';
            
            const cardSelector = document.getElementById('event-loyalty-card');
            if (cardSelector && cardSelector.options.length === 2) {
                cardSelector.selectedIndex = 1;
            }
        }
        
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    }

    async loadLoyaltyCardsForEventModal() {
    const selector = document.getElementById('event-loyalty-card');
    if (!selector) return;
    
    try {
        // Get restaurant from session first
        const restaurant = JSON.parse(sessionStorage.getItem('restaurant') || '{}');
        if (!restaurant.id) {
            console.error('No restaurant ID in session');
            selector.innerHTML = '<option value="">No restaurant found - please refresh</option>';
            return;
        }
        
        // Fetch loyalty cards directly using restaurant ID from session
        const { data: loyaltyCards, error } = await supabase
            .from('loyalty_cards')
            .select('*')
            .eq('restaurant_id', restaurant.id)
            .eq('is_active', true)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error fetching loyalty cards:', error);
            selector.innerHTML = '<option value="">Error loading cards</option>';
            return;
        }
        
        // Build options
        let html = '<option value="">-- Select a location --</option>';
        
        if (loyaltyCards && loyaltyCards.length > 0) {
            loyaltyCards.forEach(card => {
                const locationStr = card.location_name || restaurant.location || 'Main Location';
                const status = card.campaign_status === 'live' ? '🟢' : '📝';
                html += `<option value="${card.id}" data-restaurant-id="${restaurant.id}">
                    ${status} ${card.display_name || 'Loyalty Card'} - ${locationStr}
                </option>`;
            });
        } else {
            html += '<option value="">No active loyalty cards found</option>';
        }
        
        selector.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading loyalty cards:', error);
        selector.innerHTML = '<option value="">Error loading cards</option>';
    }
}

    fillEventForm(event) {
        document.getElementById('event-id').value = event.id;
        document.getElementById('event-title').value = event.title || '';
        document.getElementById('event-description').value = event.description || '';
        document.getElementById('event-date').value = event.event_date || '';
        document.getElementById('event-time').value = event.event_time || '';
        document.getElementById('event-end-time').value = event.end_time || '';
        document.getElementById('event-capacity').value = event.capacity || '';
        document.getElementById('event-status').value = event.status || 'draft';
        
        if (event.loyalty_card_id) {
            document.getElementById('event-loyalty-card').value = event.loyalty_card_id;
        }
        
        if (event.background_color) {
            document.getElementById('event-bg-color').value = event.background_color;
        }
        
        if (event.image_url) {
            const preview = document.getElementById('event-image-preview');
            const placeholder = document.querySelector('#event-image-upload .upload-placeholder');
            if (preview) {
                preview.src = event.image_url;
                preview.style.display = 'block';
            }
            if (placeholder) placeholder.style.display = 'none';
        }
    }

    closeEventModal() {
        const modal = document.getElementById('event-modal');
        if (!modal) return;
        
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    }
// Replace the saveEvent method in modals.js with this version:

async saveEvent() {
    const form = document.getElementById('event-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const id = document.getElementById('event-id').value;
    const loyaltyCardId = document.getElementById('event-loyalty-card').value;
    
    console.log('Starting saveEvent with loyalty_card_id:', loyaltyCardId);
    
    if (!loyaltyCardId) {
        alert('Please select a location/loyalty card for this event');
        return;
    }
    
    const selectedOption = document.querySelector(`#event-loyalty-card option[value="${loyaltyCardId}"]`);
    const restaurantId = selectedOption ? selectedOption.dataset.restaurantId : null;
    
    if (!restaurantId) {
        alert('Invalid location selected');
        return;
    }
    
    let statusValue = document.getElementById('event-status').value;
    if (statusValue !== 'active' && statusValue !== 'draft') {
        statusValue = 'draft';
    }
    
    const imageInput = document.getElementById('event-image-input');
    const hasImage = imageInput && imageInput.files && imageInput.files.length > 0;
    const backgroundColor = hasImage ? null : (document.getElementById('event-bg-color')?.value || '#7c5ce6');
    
    const eventData = {
        title: document.getElementById('event-title').value,
        description: document.getElementById('event-description').value,
        event_date: document.getElementById('event-date').value,
        event_time: document.getElementById('event-time').value || null,
        end_time: document.getElementById('event-end-time')?.value || null,
        capacity: parseInt(document.getElementById('event-capacity').value) || null,
        status: statusValue,
        restaurant_id: restaurantId,
        loyalty_card_id: loyaltyCardId,
        background_color: backgroundColor,
        image_url: null
    };
    
    // FETCH LOYALTY CARD LOCATION DATA BEFORE SAVING
    console.log('Fetching loyalty card data for ID:', loyaltyCardId);
    try {
        const { data: loyaltyCard, error: cardError } = await supabase
            .from('loyalty_cards')
            .select('location_address, location_latitude, location_longitude, location_name, display_name')
            .eq('id', loyaltyCardId)
            .single();
        
        console.log('Loyalty card fetch result:', loyaltyCard, 'Error:', cardError);
        
        if (!cardError && loyaltyCard) {
            eventData.location_address = loyaltyCard.location_address;
            eventData.location_latitude = loyaltyCard.location_latitude;
            eventData.location_longitude = loyaltyCard.location_longitude;
            eventData.location_name = loyaltyCard.location_name || loyaltyCard.display_name;
            console.log('Added location data to event:', {
                address: eventData.location_address,
                lat: eventData.location_latitude,
                lng: eventData.location_longitude,
                name: eventData.location_name
            });
        } else {
            console.warn('Could not fetch loyalty card data:', cardError);
        }
    } catch (error) {
        console.error('Error fetching loyalty card:', error);
    }
    
    try {
        // Handle image upload if present
        if (hasImage) {
            const file = imageInput.files[0];
            const fileName = `event_${Date.now()}_${file.name}`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('event-images')
                .upload(fileName, file);
            
            if (uploadError) {
                console.error('Error uploading image:', uploadError);
            } else {
                const { data: { publicUrl } } = supabase.storage
                    .from('event-images')
                    .getPublicUrl(fileName);
                
                eventData.image_url = publicUrl;
                eventData.background_color = null;
            }
        }
        
        console.log('Final event data before save:', eventData);
        
        if (id) {
            // Update existing event
            const { data: result, error } = await supabase
                .from('events')
                .update({
                    ...eventData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select();
            
            if (error) throw error;
            console.log('Event updated successfully:', result);
            
            this.closeEventModal();
            
            if (window.eventsManager) {
                await window.eventsManager.loadEvents();
            }
            
            this.showSuccessWithNotificationPrompt({
                type: 'event',
                data: result[0],
                message: 'Event updated successfully!'
            });
        } else {
            // Create new event
            const { data: result, error } = await supabase
                .from('events')
                .insert([{
                    ...eventData,
                    created_at: new Date().toISOString(),
                    interested_count: 0,
                    view_count: 0
                }])
                .select();
            
            if (error) throw error;
            console.log('Event created successfully:', result);
            
            this.closeEventModal();
            
            if (window.eventsManager) {
                await window.eventsManager.loadEvents();
            }
            
            this.showSuccessWithNotificationPrompt({
                type: 'event',
                data: result[0],
                message: 'Event created successfully!'
            });
        }
        
    } catch (error) {
        console.error('Error saving event:', error);
        alert('Error saving event: ' + error.message);
    }
}

    // ==================== NOTIFICATION MODAL ====================
    
    async openNotificationModal(notification = null) {
        const modal = document.getElementById('notification-modal');
        if (!modal) {
            console.error('Notification modal not found');
            return;
        }

        const form = document.getElementById('notification-form');
        
        await this.loadLoyaltyCardsForNotificationModal();
        
        form.reset();
        document.getElementById('notification-id').value = '';
        document.getElementById('notification-chars').textContent = '0';
        
        await this.loadEventsAndPromotions();
        
        if (notification) {
            if (notification.id) {
                document.getElementById('notification-id').value = notification.id;
            }
            document.getElementById('notification-title').value = notification.title || '';
            document.getElementById('notification-message').value = notification.message || '';
            document.getElementById('notification-type').value = notification.notification_type || 'custom';
            
            if (notification.loyalty_card_id) {
                document.getElementById('notification-loyalty-card').value = notification.loyalty_card_id;
            }
            
            if (notification.related_type && notification.related_id) {
                const selector = document.getElementById('notification-related-selector');
                if (selector) {
                    selector.value = `${notification.related_type}_${notification.related_id}`;
                }
            }
            
            const messageLength = (notification.message || '').length;
            document.getElementById('notification-chars').textContent = messageLength;
            
            document.getElementById('preview-title').textContent = notification.title || 'Your Restaurant';
            document.getElementById('preview-message').textContent = notification.message || 'Your message will appear here';
        } else {
            const cardSelector = document.getElementById('notification-loyalty-card');
            if (cardSelector && cardSelector.options.length === 2) {
                cardSelector.selectedIndex = 1;
            }
        }
        
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    }

    async loadLoyaltyCardsForNotificationModal() {
        const selector = document.getElementById('notification-loyalty-card');
        if (!selector) return;
        
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            
            const { data: restaurants } = await supabase
                .from('restaurants')
                .select('id, name, location')
                .eq('owner_id', user.id);
            
            if (!restaurants || restaurants.length === 0) {
                selector.innerHTML = '<option value="">No restaurants found</option>';
                return;
            }
            
            const restaurantIds = restaurants.map(r => r.id);
            const { data: loyaltyCards } = await supabase
                .from('loyalty_cards')
                .select('*')
                .in('restaurant_id', restaurantIds)
                .eq('is_active', true)
                .is('deleted_at', null)
                .order('created_at', { ascending: false });
            
            let html = '<option value="">-- Select a location --</option>';
            
            if (loyaltyCards && loyaltyCards.length > 0) {
                const cardsByRestaurant = {};
                loyaltyCards.forEach(card => {
                    const restaurant = restaurants.find(r => r.id === card.restaurant_id);
                    const key = restaurant ? restaurant.id : 'unknown';
                    if (!cardsByRestaurant[key]) {
                        cardsByRestaurant[key] = {
                            restaurant,
                            cards: []
                        };
                    }
                    cardsByRestaurant[key].cards.push(card);
                });
                
                Object.values(cardsByRestaurant).forEach(group => {
                    const { restaurant, cards } = group;
                    if (cards.length === 1) {
                        const card = cards[0];
                        const locationStr = card.location_name || restaurant?.location || 'Main Location';
                        html += `<option value="${card.id}" data-restaurant-id="${restaurant?.id}">
                            ${card.display_name || 'Loyalty Card'} - ${locationStr}
                        </option>`;
                    } else {
                        html += `<optgroup label="${restaurant?.name || 'Restaurant'}">`;
                        cards.forEach(card => {
                            const locationStr = card.location_name || 'Main Location';
                            html += `<option value="${card.id}" data-restaurant-id="${restaurant?.id}">
                                ${card.display_name || 'Loyalty Card'} - ${locationStr}
                            </option>`;
                        });
                        html += '</optgroup>';
                    }
                });
            } else {
                html += '<option value="">No active loyalty cards found</option>';
            }
            
            selector.innerHTML = html;
            
        } catch (error) {
            console.error('Error loading loyalty cards:', error);
            selector.innerHTML = '<option value="">Error loading cards</option>';
        }
    }

    closeNotificationModal() {
        const modal = document.getElementById('notification-modal');
        if (!modal) return;
        
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    }

    async sendNotification() {
        const form = document.getElementById('notification-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        const id = document.getElementById('notification-id').value;
        const loyaltyCardId = document.getElementById('notification-loyalty-card').value;
        
        if (!loyaltyCardId) {
            alert('Please select a location/loyalty card for this notification');
            return;
        }
        
        const selectedOption = document.querySelector(`#notification-loyalty-card option[value="${loyaltyCardId}"]`);
        const restaurantId = selectedOption ? selectedOption.dataset.restaurantId : null;
        
        if (!restaurantId) {
            alert('Invalid location selected');
            return;
        }
        
        const scheduleType = document.querySelector('input[name="schedule"]:checked')?.value;
        
        const relatedSelector = document.getElementById('notification-related-selector');
        let relatedType = null;
        let relatedId = null;
        
        if (relatedSelector && relatedSelector.value && relatedSelector.value !== 'none') {
            const [type, itemId] = relatedSelector.value.split('_');
            relatedType = type;
            relatedId = itemId;
        }
        
        const notificationData = {
            title: document.getElementById('notification-title').value,
            message: document.getElementById('notification-message').value,
            notification_type: document.getElementById('notification-type').value,
            related_type: relatedType,
            related_id: relatedId,
            restaurant_id: restaurantId,
            loyalty_card_id: loyaltyCardId
        };
        
        if (scheduleType === 'scheduled') {
            const date = document.getElementById('notification-date').value;
            const time = document.getElementById('notification-time').value;
            if (date && time) {
                notificationData.scheduled_for = new Date(`${date}T${time}`).toISOString();
            }
        } else {
            notificationData.sent_at = new Date().toISOString();
            notificationData.recipients_count = Math.floor(Math.random() * 100) + 50;
        }
        
        if (window.notificationsManager) {
            await window.notificationsManager.sendNotification(notificationData);
            this.closeNotificationModal();
        } else {
            console.error('Notifications manager not found');
        }
    }

    async loadEventsAndPromotions() {
        const selector = document.getElementById('notification-related-selector');
        if (!selector) return;
        
        const loyaltyCardId = document.getElementById('notification-loyalty-card').value;
        if (!loyaltyCardId) {
            selector.innerHTML = '<option value="none">-- Select a location first --</option>';
            return;
        }
        
        try {
            const { data: events } = await supabase
                .from('events')
                .select('id, title, event_date, event_time')
                .eq('loyalty_card_id', loyaltyCardId)
                .eq('status', 'active')
                .order('event_date', { ascending: true });
            
            const { data: promotions } = await supabase
                .from('promotions')
                .select('id, title, description')
                .eq('loyalty_card_id', loyaltyCardId)
                .eq('status', 'active')
                .order('created_at', { ascending: false });
            
            let html = '<option value="none">-- Select an event or promotion (optional) --</option>';
            
            if (events && events.length > 0) {
                html += '<optgroup label="Events">';
                events.forEach(event => {
                    const eventDate = event.event_date ? 
                        new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 
                        'TBD';
                    html += `<option value="event_${event.id}">${event.title} (${eventDate})</option>`;
                });
                html += '</optgroup>';
            }
            
            if (promotions && promotions.length > 0) {
                html += '<optgroup label="Promotions">';
                promotions.forEach(promotion => {
                    html += `<option value="promotion_${promotion.id}">${promotion.title}</option>`;
                });
                html += '</optgroup>';
            }
            
            selector.innerHTML = html;
            
        } catch (error) {
            console.error('Error loading events and promotions:', error);
        }
    }

    showSuccessWithNotificationPrompt(config) {
        const { type, data, message } = config;
        
        const successModal = document.createElement('div');
        successModal.className = 'success-modal';
        successModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            animation: fadeIn 0.3s ease;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            animation: slideUp 0.3s ease;
        `;
        
        modalContent.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <svg width="48" height="48" fill="none" stroke="#10b981" stroke-width="2" viewBox="0 0 24 24" style="margin: 0 auto 12px;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">${message}</h3>
                <p style="margin: 0; color: #6b7280;">Would you like to notify your customers about this ${type}?</p>
            </div>
            <div style="display: flex; gap: 12px;">
                <button id="success-notify-btn" style="
                    flex: 1;
                    background: #6366f1;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    padding: 10px 16px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                ">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                    </svg>
                    Send Notification
                </button>
                <button id="success-close-btn" style="
                    flex: 1;
                    background: #f3f4f6;
                    color: #374151;
                    border: none;
                    border-radius: 8px;
                    padding: 10px 16px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                ">
                    Maybe Later
                </button>
            </div>
        `;
        
        successModal.appendChild(modalContent);
        document.body.appendChild(successModal);
        
        document.getElementById('success-notify-btn').addEventListener('click', () => {
            this.storePendingNotification(type, data);
            successModal.remove();
            
            if (window.location.pathname.includes('dashboard')) {
                document.getElementById('nav-notifications')?.click();
                setTimeout(() => {
                    this.openNotificationModalFromContext(type, data);
                }, 300);
            } else {
                this.openNotificationModalFromContext(type, data);
            }
        });
        
        document.getElementById('success-close-btn').addEventListener('click', () => {
            successModal.remove();
        });
    }

    setupEventPromotionSelector() {
        const selector = document.getElementById('notification-related-selector');
        if (!selector) return;
        
        selector.addEventListener('change', (e) => {
            if (e.target.value === 'none') {
                document.getElementById('notification-title').value = '';
                document.getElementById('notification-message').value = '';
                document.getElementById('notification-type').value = 'custom';
            } else {
                const [type, id] = e.target.value.split('_');
                this.prefillNotificationFromSelection(type, id);
            }
        });
    }

    async prefillNotificationFromSelection(type, id) {
        try {
            if (type === 'event') {
                const { data: event } = await supabase
                    .from('events')
                    .select('*')
                    .eq('id', id)
                    .single();
                
                if (event) {
                    const eventDate = event.event_date ? 
                        new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 
                        'TBD';
                    const eventTime = this.formatTime(event.event_time);
                    
                    document.getElementById('notification-title').value = `Event: ${event.title}`;
                    document.getElementById('notification-message').value = 
                        `Join us ${eventDate !== 'TBD' ? `on ${eventDate}` : ''} ${eventTime ? `at ${eventTime}` : ''}! ${event.description || ''}`.trim();
                    document.getElementById('notification-type').value = 'event';
                    
                    this.updateCharacterCount();
                    this.updatePreview();
                }
            } else if (type === 'promotion') {
                const { data: promotion } = await supabase
                    .from('promotions')
                    .select('*')
                    .eq('id', id)
                    .single();
                
                if (promotion) {
                    document.getElementById('notification-title').value = `Special Offer: ${promotion.title}`;
                    document.getElementById('notification-message').value = 
                        promotion.description || `Don't miss our ${promotion.title} promotion!`;
                    document.getElementById('notification-type').value = 'promotion';
                    
                    this.updateCharacterCount();
                    this.updatePreview();
                }
            }
        } catch (error) {
            console.error('Error prefilling notification:', error);
        }
    }

    openNotificationModalFromContext(type, data) {
        let notificationData = {
            notification_type: type,
            related_type: type,
            related_id: data.id,
            loyalty_card_id: data.loyalty_card_id
        };
        
        if (type === 'event') {
            const eventDate = data.event_date ? 
                new Date(data.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 
                'TBD';
            const eventTime = this.formatTime(data.event_time);
            
            notificationData.title = `Event: ${data.title}`;
            notificationData.message = `Join us ${eventDate !== 'TBD' ? `on ${eventDate}` : ''} ${eventTime ? `at ${eventTime}` : ''}! ${data.description || ''}`.trim();
        } else if (type === 'promotion') {
            notificationData.title = `Special Offer: ${data.title}`;
            notificationData.message = data.description || `Don't miss our ${data.title} promotion!`;
        }
        
        this.openNotificationModal(notificationData);
    }

    storePendingNotification(type, data) {
        sessionStorage.setItem('pendingNotification', JSON.stringify({ type, data }));
    }

    checkPendingNotification() {
        const pending = sessionStorage.getItem('pendingNotification');
        if (pending) {
            const { type, data } = JSON.parse(pending);
            sessionStorage.removeItem('pendingNotification');
            
            setTimeout(() => {
                this.openNotificationModalFromContext(type, data);
            }, 500);
        }
    }

    setupImageUploads() {
        const promotionUpload = document.getElementById('promotion-image-upload');
        const promotionInput = document.getElementById('promotion-image-input');
        
        if (promotionUpload && promotionInput) {
            promotionUpload.addEventListener('click', (e) => {
                if (e.target === promotionInput) return;
                promotionInput.click();
            });
            
            promotionInput.addEventListener('change', (e) => {
                this.handleImageUpload(e, 'promotion-image-preview', '#promotion-image-upload .upload-placeholder');
            });
        }
        
        const eventUpload = document.getElementById('event-image-upload');
        const eventInput = document.getElementById('event-image-input');
        
        if (eventUpload && eventInput) {
            eventUpload.addEventListener('click', (e) => {
                if (e.target === eventInput) return;
                eventInput.click();
            });
            
            eventInput.addEventListener('change', (e) => {
                this.handleImageUpload(e, 'event-image-preview', '#event-image-upload .upload-placeholder');
            });
        }
    }

    handleImageUpload(event, previewId, placeholderSelector) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById(previewId);
            const placeholder = document.querySelector(placeholderSelector);
            
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
            if (placeholder) placeholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    setupCharacterCounter() {
        const messageInput = document.getElementById('notification-message');
        const charCount = document.getElementById('notification-chars');
        
        if (messageInput && charCount) {
            messageInput.addEventListener('input', () => {
                this.updateCharacterCount();
            });
        }
    }

    updateCharacterCount() {
        const messageInput = document.getElementById('notification-message');
        const charCount = document.getElementById('notification-chars');
        
        if (messageInput && charCount) {
            const length = messageInput.value.length;
            charCount.textContent = length;
            
            charCount.parentElement.classList.remove('warning', 'error');
            if (length > 200) {
                charCount.parentElement.classList.add('warning');
            }
            if (length >= 250) {
                charCount.parentElement.classList.add('error');
            }
        }
    }

    setupScheduleOptions() {
        const scheduleRadios = document.querySelectorAll('input[name="schedule"]');
        const schedulePicker = document.getElementById('schedule-picker');
        
        scheduleRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (schedulePicker) {
                    schedulePicker.style.display = radio.value === 'scheduled' ? 'block' : 'none';
                }
            });
        });
    }

    setupTimeSuggestions() {
        const suggestionChips = document.querySelectorAll('.suggestion-chip');
        
        suggestionChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const time = chip.dataset.time;
                const timeInput = document.getElementById('notification-time');
                const scheduledRadio = document.querySelector('input[name="schedule"][value="scheduled"]');
                const schedulePicker = document.getElementById('schedule-picker');
                
                if (timeInput) timeInput.value = time;
                if (scheduledRadio) scheduledRadio.checked = true;
                if (schedulePicker) schedulePicker.style.display = 'block';
                
                const dateInput = document.getElementById('notification-date');
                if (dateInput && !dateInput.value) {
                    dateInput.value = new Date().toISOString().split('T')[0];
                }
            });
        });
    }

    setupLivePreview() {
        const titleInput = document.getElementById('notification-title');
        const messageInput = document.getElementById('notification-message');
        const previewTitle = document.getElementById('preview-title');
        const previewMessage = document.getElementById('preview-message');
        
        if (titleInput && previewTitle) {
            titleInput.addEventListener('input', () => {
                this.updatePreview();
            });
        }
        
        if (messageInput && previewMessage) {
            messageInput.addEventListener('input', () => {
                this.updatePreview();
            });
        }
    }

    updatePreview() {
        const titleInput = document.getElementById('notification-title');
        const messageInput = document.getElementById('notification-message');
        const previewTitle = document.getElementById('preview-title');
        const previewMessage = document.getElementById('preview-message');
        
        if (titleInput && previewTitle) {
            previewTitle.textContent = titleInput.value || 'Your Restaurant';
        }
        
        if (messageInput && previewMessage) {
            previewMessage.textContent = messageInput.value || 'Your message will appear here';
        }
    }

    connectToManagers() {
        window.modalManager = this;
        
        const connectManagers = () => {
            if (window.promotionsManager) {
                window.promotionsManager.openCreateModal = (data) => this.openPromotionModal(data);
                window.promotionsManager.openEditModal = (data) => this.openPromotionModal(data);
            }
            
            if (window.eventsManager) {
                window.eventsManager.openEventModal = (data) => this.openEventModal(data);
                window.eventsManager.openEditModal = (data) => this.openEventModal(data);
            }
            
            if (window.notificationsManager) {
                window.notificationsManager.openComposeModal = (data) => this.openNotificationModal(data);
            }
        };
        
        connectManagers();
        setTimeout(connectManagers, 100);
        setTimeout(connectManagers, 500);
    }

    formatTime(timeString) {
        if (!timeString) return '';
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    }

    showSuccess(message) {
        const notification = document.createElement('div');
        notification.className = 'success-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}



// Initialize modal manager and expose functions globally
const modalManager = new ModalManager();

// Expose functions globally for onclick handlers in HTML
window.openPromotionModal = (data) => modalManager.openPromotionModal(data);
window.closePromotionModal = () => modalManager.closePromotionModal();
window.savePromotion = () => modalManager.savePromotion();

window.openEventModal = (data) => modalManager.openEventModal(data);
window.closeEventModal = () => modalManager.closeEventModal();
window.saveEvent = () => modalManager.saveEvent();

window.openNotificationModal = (data) => modalManager.openNotificationModal(data);
window.closeNotificationModal = () => modalManager.closeNotificationModal();
window.sendNotification = () => modalManager.sendNotification();