// events.js - Compact card design without calendar view

class EventsManager {
    constructor() {
        this.events = [];
        this.restaurant = null;
        this.currentFilter = 'all';
        this.init();
    }

    async init() {
        this.restaurant = JSON.parse(sessionStorage.getItem('restaurant') || '{}');
        this.setupEventListeners();
        await this.loadEvents();
        this.displayUsageIndicator();
    }

    setupEventListeners() {
        const createBtn = document.getElementById('create-event-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.handleCreateEvent());
        }

        document.querySelectorAll('.event-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
    }

    async loadEvents() {
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .eq('restaurant_id', this.restaurant.id)
                .order('event_date', { ascending: true });

            if (error) throw error;
            this.events = data || [];
            this.renderEvents();
            
        } catch (error) {
            console.error('Error loading events:', error);
        }
    }

    displayUsageIndicator() {
        const container = document.querySelector('.events-usage-indicator');
        if (!container) return;
        
        const tier = window.subscriptionManager?.getCurrentTier() || 'free';
        const tierConfig = window.subscriptionManager?.getTierConfig() || { maxLiveEvents: 1 };
        
        const activeCount = this.events.filter(e => e.status === 'active').length;
        const limit = tierConfig.maxLiveEvents;
        
        let html = '';
        
        if (tier === 'free') {
            html = `
                <div class="usage-banner ${activeCount >= limit ? 'at-limit' : ''}">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span>Free plan: ${activeCount} of ${limit} active event allowed</span>
                    ${activeCount >= limit ? `
                        <button class="btn-upgrade-inline" onclick="window.subscriptionManager.showUpgradeModal('events', 'basic')">
                            Upgrade for More
                        </button>
                    ` : ''}
                </div>
            `;
        } else {
            const percentage = (activeCount / limit) * 100;
            const isAtLimit = activeCount >= limit;
            
            html = `
                <div class="usage-banner ${isAtLimit ? 'at-limit' : ''}">
                    <div class="usage-text">
                        <span>Active Events: ${activeCount} of ${limit === 999 ? 'Unlimited' : limit}</span>
                    </div>
                    ${limit !== 999 ? `
                        <div class="usage-bar">
                            <div class="usage-progress" style="width: ${Math.min(percentage, 100)}%"></div>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        container.innerHTML = html;
    }

    renderEvents() {
        const now = new Date();
        const activeEvents = [];
        const pastEvents = [];
        const draftEvents = [];
        
        this.events.forEach(event => {
            if (event.status === 'draft') {
                draftEvents.push(event);
            } else if (event.status === 'active') {
                // More accurate past event detection
                let isPast = false;
                
                if (event.event_date) {
                    // If there's an end_time, use that for comparison
                    if (event.end_time) {
                        const eventEnd = new Date(`${event.event_date}T${event.end_time}`);
                        isPast = eventEnd < now;
                    } else if (event.event_time) {
                        // If only start time, assume event is 2 hours long
                        const eventStart = new Date(`${event.event_date}T${event.event_time}`);
                        const eventEnd = new Date(eventStart.getTime() + (2 * 60 * 60 * 1000)); // Add 2 hours
                        isPast = eventEnd < now;
                    } else {
                        // If no time specified, check if the date is before today
                        const eventDate = new Date(event.event_date);
                        eventDate.setHours(23, 59, 59, 999); // End of day
                        isPast = eventDate < now;
                    }
                }
                
                if (isPast) {
                    pastEvents.push(event);
                } else {
                    activeEvents.push(event);
                }
            }
        });
        
        this.updateTabCounts(activeEvents.length, pastEvents.length, draftEvents.length);
        
        let container;
        let eventsToShow = [];
        
        switch(this.currentFilter) {
            case 'all':
                container = document.getElementById('events-list');
                eventsToShow = activeEvents;
                break;
            case 'past':
                container = document.getElementById('past-events');
                eventsToShow = pastEvents;
                break;
            case 'draft':
                container = document.getElementById('draft-events');
                eventsToShow = draftEvents;
                break;
        }
        
        if (!container) return;
        
        if (eventsToShow.length === 0) {
            container.innerHTML = this.getEmptyState();
        } else {
            container.innerHTML = `
                <div class="events-grid">
                    ${eventsToShow.map(event => this.createCompactEventCard(event)).join('')}
                </div>
            `;
        }
        
        this.attachCardListeners();
    }

    createCompactEventCard(event) {
        const eventDate = event.event_date ? new Date(event.event_date) : null;
        
        // Format time string with start and end time
        let timeStr = '';
        if (event.event_time) {
            timeStr = this.formatTime(event.event_time);
            if (event.end_time) {
                timeStr += ` - ${this.formatTime(event.end_time)}`;
            }
        } else {
            timeStr = 'Time TBD';
        }
        
        const isActive = event.status === 'active';
        const isPast = this.currentFilter === 'past';
        const isDraft = event.status === 'draft';
        
        // Determine background style for date badge
        let dateBackgroundStyle = '';
        if (event.image_url) {
            dateBackgroundStyle = `background-image: url('${event.image_url}'); background-size: cover; background-position: center;`;
        } else if (event.background_color) {
            dateBackgroundStyle = `background: linear-gradient(135deg, ${event.background_color}, ${this.adjustColor(event.background_color, -20)});`;
        } else {
            dateBackgroundStyle = 'background: linear-gradient(135deg, #667eea, #764ba2);';
        }
        
        return `
            <div class="event-card-compact ${isActive ? 'active' : ''} ${isDraft ? 'draft' : ''}" data-id="${event.id}">
                <div class="event-card-header">
                    <div class="event-date-compact" style="${dateBackgroundStyle}">
                        ${eventDate ? `
                            <div class="date-month">${eventDate.toLocaleDateString('en-US', { month: 'short' })}</div>
                            <div class="date-day">${eventDate.getDate()}</div>
                        ` : '<div class="date-tbd">TBD</div>'}
                    </div>
                    
                    <div class="event-info-compact">
                        <h4>${event.title}</h4>
                        ${event.description ? `<p>${event.description.substring(0, 60)}${event.description.length > 60 ? '...' : ''}</p>` : ''}
                        <div class="event-meta-compact">
                            ${timeStr ? `
                                <span>
                                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                    ${timeStr}
                                </span>
                            ` : ''}
                            ${event.capacity ? `
                                <span>
                                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                                    </svg>
                                    ${event.capacity} spots
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="event-actions-compact">
                        ${!isPast ? `
                            ${isDraft ? `
                                <button class="btn-action btn-edit" data-action="edit" data-id="${event.id}" data-tooltip="Edit">
                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                    </svg>
                                </button>
                                
                                <button class="btn-action btn-live" data-action="activate" data-id="${event.id}" data-tooltip="Go Live">
                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                </button>
                            ` : `
                                <button class="btn-action btn-draft" data-action="deactivate" data-id="${event.id}" data-tooltip="Make Draft">
                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                </button>
                                
                                <button class="btn-action btn-edit" data-action="edit" data-id="${event.id}" data-tooltip="Edit">
                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                    </svg>
                                </button>
                            `}
                        ` : ''}
                        
                        <button class="btn-action btn-delete" data-action="delete" data-id="${event.id}" data-tooltip="Delete">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    </div>
                </div>
                
                ${isActive ? '<div class="event-status-dot active"></div>' : ''}
                ${isDraft ? '<div class="event-status-dot draft"></div>' : ''}
            </div>
        `;
    }

    updateTabCounts(activeCount, pastCount, draftCount) {
        const tabs = document.querySelectorAll('.event-tabs .tab-btn');
        tabs.forEach(tab => {
            const tabType = tab.dataset.tab;
            let count = 0;
            let label = '';
            
            switch(tabType) {
                case 'all':
                    count = activeCount;
                    label = 'Events';
                    break;
                case 'past':
                    count = pastCount;
                    label = 'Past';
                    break;
                case 'draft':
                    count = draftCount;
                    label = 'Drafts';
                    break;
            }
            
            tab.innerHTML = `${label} <span class="tab-count">(${count})</span>`;
        });
    }

    getEmptyState() {
        const messages = {
            'all': 'No upcoming events',
            'past': 'No past events',
            'draft': 'No draft events'
        };
        
        return `
            <div class="empty-state">
                <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <h3>${messages[this.currentFilter]}</h3>
                ${this.currentFilter === 'all' ? '<p>Create an event to engage with your customers</p>' : ''}
            </div>
        `;
    }

    formatTime(timeString) {
        if (!timeString) return '';
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    }

    attachCardListeners() {
        document.querySelectorAll('.event-card-compact .btn-action').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                
                switch(action) {
                    case 'activate':
                        await this.toggleEventStatus(id, 'active');
                        break;
                    case 'deactivate':
                        await this.toggleEventStatus(id, 'draft');
                        break;
                    case 'edit':
                        this.editEvent(id);
                        break;
                    case 'delete':
                        if (confirm('Delete this event?')) {
                            await this.deleteEvent(id);
                        }
                        break;
                }
            });
        });
    }

    switchTab(tab) {
        document.querySelectorAll('.event-tabs .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        
        document.querySelectorAll('#events-section .tab-content').forEach(content => {
            content.style.display = 'none';
        });
        
        let tabContentIndex;
        switch(tab) {
            case 'all':
                tabContentIndex = 0;
                break;
            case 'past':
                tabContentIndex = 1;
                break;
            case 'draft':
                tabContentIndex = 2;
                break;
        }
        
        const tabContents = document.querySelectorAll('#events-section .tab-content');
        if (tabContents[tabContentIndex]) {
            tabContents[tabContentIndex].style.display = 'block';
        }
        
        this.currentFilter = tab;
        this.renderEvents();
    }

    handleCreateEvent() {
        if (window.openEventModal) {
            window.openEventModal();
        } else if (window.modalManager && window.modalManager.openEventModal) {
            window.modalManager.openEventModal();
        }
    }

async createEvent(eventData) {
    try {
        eventData.restaurant_id = this.restaurant.id;
        
        // Fetch loyalty card location data BEFORE creating the event
        if (eventData.loyalty_card_id) {
            const { data: loyaltyCard, error: cardError } = await supabase
                .from('loyalty_cards')
                .select('location_address, location_latitude, location_longitude, location_name, display_name')
                .eq('id', eventData.loyalty_card_id)
                .single();
            
            if (!cardError && loyaltyCard) {
                eventData.location_address = loyaltyCard.location_address;
                eventData.location_latitude = loyaltyCard.location_latitude;
                eventData.location_longitude = loyaltyCard.location_longitude;
                eventData.location_name = loyaltyCard.location_name || loyaltyCard.display_name;
            }
        }
        
        // Check subscription limits
        if (eventData.status === 'active' && window.subscriptionManager) {
            const canActivate = await window.subscriptionManager.canPerformAction('events', 'go_live');
            if (!canActivate.allowed) {
                eventData.status = 'draft';
                alert('You\'ve reached your active event limit. The event will be saved as a draft.');
            }
        }

        // Now insert the event with location data already included
        const { data, error } = await supabase
            .from('events')
            .insert([{
                ...eventData,
                created_at: new Date().toISOString(),
                interested_count: 0,
                view_count: 0
            }])
            .select();

        if (error) throw error;

        await this.loadEvents();
        return { success: true, data: data[0] };
        
    } catch (error) {
        console.error('Error creating event:', error);
        alert('Error creating event. Please try again.');
        return { success: false, error };
    }
}

    async toggleEventStatus(id, newStatus) {
        try {
            if (newStatus === 'active' && window.subscriptionManager) {
                const canActivate = await window.subscriptionManager.canPerformAction('events', 'go_live');
                if (!canActivate.allowed) {
                    if (canActivate.requiresUpgrade) {
                        window.subscriptionManager.showUpgradeModal('events', canActivate.suggestedTier);
                    }
                    return;
                }
            }

            const { error } = await supabase
                .from('events')
                .update({ 
                    status: newStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;
            await this.loadEvents();
            
        } catch (error) {
            console.error('Error toggling event status:', error);
        }
    }

    editEvent(id) {
        const event = this.events.find(e => e.id === id);
        if (event) {
            if (window.openEventModal) {
                window.openEventModal(event);
            } else if (window.modalManager && window.modalManager.openEventModal) {
                window.modalManager.openEventModal(event);
            }
        }
    }

    async deleteEvent(id) {
        try {
            const { error } = await supabase
                .from('events')
                .delete()
                .eq('id', id);

            if (error) throw error;
            await this.loadEvents();
            
        } catch (error) {
            console.error('Error deleting event:', error);
        }
    }

    adjustColor(color, amount) {
        const usePound = color[0] === '#';
        const col = usePound ? color.slice(1) : color;
        const num = parseInt(col, 16);
        const r = Math.min(255, Math.max(0, (num >> 16) + amount));
        const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
        const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
        return (usePound ? '#' : '') + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.eventsManager = new EventsManager();
    });
} else {
    window.eventsManager = new EventsManager();
}