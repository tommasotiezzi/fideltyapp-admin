// notifications.js - Push Notifications Management with Tier-Based Limits

class NotificationsManager {
    constructor() {
        this.notifications = [];
        this.restaurant = null;
        this.currentTab = 'scheduled';
        this.init();
    }

    async init() {
        // Get restaurant data
        this.restaurant = JSON.parse(sessionStorage.getItem('restaurant') || '{}');
        
        // Get tier configuration
        const tierConfig = window.subscriptionManager.getTierConfig();
        this.maxNotifications = tierConfig.maxNotificationsPerMonth;
        
        // Load notifications
        await this.loadNotifications();
        
        // Display usage indicator
        this.displayUsageIndicator();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Check for monthly reset
        this.checkMonthlyReset();
    }

    /**
     * Display monthly notification usage indicator
     */
    displayUsageIndicator() {
        const container = document.querySelector('.notifications-usage-indicator');
        if (!container) return;
        
        const tier = window.subscriptionManager.getCurrentTier();
        const tierConfig = window.subscriptionManager.getTierConfig();
        const limit = tierConfig.maxNotificationsPerMonth;
        const sentCount = this.restaurant.notifications_sent_this_month || 0;
        
        let html = '';
        
        if (tier === 'free') {
            html = `
                <div class="usage-banner warning">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span>Free plan doesn't include push notifications</span>
                    <button class="btn-upgrade-inline" onclick="window.subscriptionManager.showUpgradeModal('notifications', 'basic')">
                        Upgrade to Send Notifications
                    </button>
                </div>
            `;
        } else {
            const percentage = limit > 0 ? (sentCount / limit * 100) : 0;
            const remaining = Math.max(0, limit - sentCount);
            const isAtLimit = sentCount >= limit;
            
            // Calculate days until reset
            const resetDate = this.getNextResetDate();
            const daysUntilReset = Math.ceil((resetDate - new Date()) / (1000 * 60 * 60 * 24));
            
            html = `
                <div class="usage-banner ${isAtLimit ? 'at-limit' : sentCount >= limit - 1 ? 'warning' : ''}">
                    <div class="usage-info">
                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                        </svg>
                        <div>
                            <span class="usage-text">
                                ${isAtLimit ? 
                                    `You've reached your limit of ${limit} notifications this month` :
                                    `${remaining} notification${remaining !== 1 ? 's' : ''} remaining this month`
                                }
                            </span>
                            ${limit !== 999 ? `
                                <div class="usage-bar">
                                    <div class="usage-progress ${isAtLimit ? 'limit-reached' : ''}" style="width: ${Math.min(percentage, 100)}%"></div>
                                </div>
                            ` : ''}
                            <p class="reset-info">Resets in ${daysUntilReset} day${daysUntilReset !== 1 ? 's' : ''} (${resetDate.toLocaleDateString()})</p>
                        </div>
                    </div>
                    ${isAtLimit && tier !== 'enterprise' ? `
                        <button class="btn-upgrade-inline" onclick="window.subscriptionManager.showUpgradeModal('notifications', '${tier === 'basic' ? 'premium' : 'enterprise'}')">
                            Need More?
                        </button>
                    ` : ''}
                </div>
            `;
        }
        
        // Also update the inline counter in the section header
        const sentEl = document.getElementById('notifications-sent');
        const maxEl = document.getElementById('max-notifications');
        const progressBar = document.getElementById('notifications-usage-bar');
        const resetEl = document.getElementById('reset-date');
        
        if (sentEl) sentEl.textContent = sentCount;
        if (maxEl) maxEl.textContent = limit === 999 ? 'Unlimited' : limit;
        if (progressBar) {
            const percentage = limit > 0 && limit !== 999 ? (sentCount / limit * 100) : 0;
            progressBar.style.width = `${Math.min(percentage, 100)}%`;
        }
        if (resetEl) {
            const resetDate = this.getNextResetDate();
            resetEl.textContent = resetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        }
        
        container.innerHTML = html;
    }

    setupEventListeners() {
        // Send notification button
        const sendBtn = document.getElementById('send-notification-btn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.handleSendNotification());
        }

        // Tab buttons
        document.querySelectorAll('#notifications-section .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentTab = e.target.dataset.tab;
                this.switchTab(e.target);
            });
        });

        // Template selection
        const templates = document.querySelectorAll('.notification-template');
        templates.forEach(template => {
            template.addEventListener('click', () => this.selectTemplate(template.dataset.template));
        });
    }

    async loadNotifications() {
        try {
            const { data, error } = await supabase
                .from('push_notifications')
                .select('*')
                .eq('restaurant_id', this.restaurant.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.notifications = data || [];
            
            // Count notifications sent this month
            this.countMonthlyNotifications();
            
            // Render notifications
            this.renderNotifications();
            
            // Update stats
            this.updateNotificationStats();
            
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    countMonthlyNotifications() {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const sentThisMonth = this.notifications.filter(n => {
            if (!n.sent_at) return false;
            const sentDate = new Date(n.sent_at);
            return sentDate >= startOfMonth;
        }).length;
        
        // Update restaurant data
        this.restaurant.notifications_sent_this_month = sentThisMonth;
        sessionStorage.setItem('restaurant', JSON.stringify(this.restaurant));
    }

    async handleSendNotification() {
        const tier = window.subscriptionManager.getCurrentTier();
        
        // Check if user can send notifications
        if (tier === 'free') {
            window.subscriptionManager.showUpgradeModal('notifications', 'basic');
            return;
        }
        
        const canSend = await window.subscriptionManager.canPerformAction('notifications', 'send');
        
        if (!canSend.allowed) {
            if (canSend.requiresUpgrade) {
                window.subscriptionManager.showUpgradeModal('notifications', canSend.suggestedTier);
            } else {
                alert(`You've reached your monthly limit of ${canSend.limit} notifications. The limit will reset on ${this.getNextResetDate().toLocaleDateString()}.`);
            }
            return;
        }
        
        // Open compose modal
        this.openComposeModal();
    }

    async sendNotification(notificationData) {
        try {
            // Check limits one more time
            const canSend = await window.subscriptionManager.canPerformAction('notifications', 'send');
            
            if (!canSend.allowed) {
                alert(canSend.message);
                return;
            }

            // Log action
            await window.subscriptionManager.logAction('send_notification', {
                notification_title: notificationData.title,
                notification_type: notificationData.notification_type,
                scheduled: notificationData.scheduled_for ? true : false,
                tier: window.subscriptionManager.getCurrentTier()
            });

            // Send or schedule notification
            const { data, error } = await supabase
                .from('push_notifications')
                .insert([{
                    ...notificationData,
                    restaurant_id: this.restaurant.id,
                    created_at: new Date().toISOString(),
                    sent_at: notificationData.scheduled_for ? null : new Date().toISOString(),
                    recipients_count: notificationData.scheduled_for ? 0 : Math.floor(Math.random() * 100) + 50 // Mock
                }])
                .select();

            if (error) throw error;

            // Update local counter
            if (!notificationData.scheduled_for) {
                this.restaurant.notifications_sent_this_month = (this.restaurant.notifications_sent_this_month || 0) + 1;
                
                // Update in database
                await supabase
                    .from('restaurants')
                    .update({ 
                        notifications_sent_this_month: this.restaurant.notifications_sent_this_month
                    })
                    .eq('id', this.restaurant.id);
                
                sessionStorage.setItem('restaurant', JSON.stringify(this.restaurant));
            }

            await this.loadNotifications();
            this.closeComposeModal();
            this.showSuccess('Notification sent successfully!');
            
        } catch (error) {
            console.error('Error sending notification:', error);
            alert('Error sending notification');
        }
    }

    renderNotifications() {
        const scheduledContainer = document.getElementById('scheduled-list');
        const historyContainer = document.getElementById('history-list');
        
        if (!scheduledContainer || !historyContainer) return;

        const now = new Date();
        const scheduled = this.notifications.filter(n => 
            n.scheduled_for && new Date(n.scheduled_for) > now
        );
        const sent = this.notifications.filter(n => n.sent_at);

        // Render scheduled notifications
        if (scheduled.length === 0) {
            scheduledContainer.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                    </svg>
                    <h3>No scheduled notifications</h3>
                    <p>Schedule notifications to engage customers at the right time</p>
                </div>
            `;
        } else {
            scheduledContainer.innerHTML = scheduled.map(n => this.createScheduledCard(n)).join('');
        }

        // Render history
        if (sent.length === 0) {
            historyContainer.innerHTML = `
                <div class="empty-state">
                    <p>No notifications sent yet</p>
                </div>
            `;
        } else {
            historyContainer.innerHTML = sent.map(n => this.createHistoryCard(n)).join('');
        }

        // Attach event listeners
        this.attachCardListeners();
    }

    createScheduledCard(notification) {
        const scheduledDate = new Date(notification.scheduled_for);
        const tier = window.subscriptionManager.getCurrentTier();
        
        return `
            <div class="scheduled-item" data-id="${notification.id}">
                <div class="scheduled-content">
                    <div class="scheduled-header">
                        <span class="notification-type-badge ${notification.notification_type}">
                            ${notification.notification_type}
                        </span>
                        <h3>${notification.title}</h3>
                    </div>
                    <p class="scheduled-message">${notification.message}</p>
                    <div class="scheduled-time">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        Scheduled for ${this.formatDateTime(scheduledDate)}
                    </div>
                </div>
                <div class="scheduled-actions">
                    ${tier !== 'free' ? `
                        <button class="scheduled-action-btn" data-action="send" data-id="${notification.id}" title="Send Now">
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                            </svg>
                        </button>
                    ` : ''}
                    <button class="scheduled-action-btn" data-action="edit" data-id="${notification.id}" title="Edit">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                    </button>
                    <button class="scheduled-action-btn" data-action="cancel" data-id="${notification.id}" title="Cancel">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    createHistoryCard(notification) {
        const sentTime = new Date(notification.sent_at);
        
        const typeBadge = {
            promotion: '<span class="notification-type-badge promotion">Promotion</span>',
            event: '<span class="notification-type-badge event">Event</span>',
            custom: '<span class="notification-type-badge custom">Custom</span>',
            loyalty: '<span class="notification-type-badge loyalty">Loyalty</span>'
        };
        
        return `
            <div class="history-item">
                <div class="history-header">
                    <div>
                        ${typeBadge[notification.notification_type] || typeBadge.custom}
                        <h3 class="history-title">${notification.title}</h3>
                        <div class="history-timestamp">Sent ${this.formatRelativeTime(sentTime)}</div>
                    </div>
                </div>
                <div class="history-message">${notification.message}</div>
                <div class="history-stats">
                    <div class="history-stat">
                        <span class="stat-label">Delivered To</span>
                        <span class="stat-value">${notification.recipients_count || 0}</span>
                    </div>
                    <div class="history-stat">
                        <span class="stat-label">Type</span>
                        <span class="stat-value">${notification.notification_type}</span>
                    </div>
                    ${notification.related_id ? `
                        <div class="history-stat">
                            <span class="stat-label">Related</span>
                            <span class="stat-value">View</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    attachCardListeners() {
        document.querySelectorAll('.scheduled-action-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                
                switch(action) {
                    case 'send':
                        await this.sendNow(id);
                        break;
                    case 'edit':
                        this.editNotification(id);
                        break;
                    case 'cancel':
                        if (confirm('Cancel this scheduled notification?')) {
                            await this.cancelNotification(id);
                        }
                        break;
                }
            });
        });
    }

    async sendNow(id) {
        // Check if at limit
        const canSend = await window.subscriptionManager.canPerformAction('notifications', 'send');
        
        if (!canSend.allowed) {
            if (canSend.requiresUpgrade) {
                window.subscriptionManager.showUpgradeModal('notifications', canSend.suggestedTier);
            } else {
                alert(`You've reached your monthly limit of ${canSend.limit} notifications.`);
            }
            return;
        }
        
        try {
            // Log action
            await window.subscriptionManager.logAction('send_notification_now', {
                notification_id: id
            });
            
            // Update notification as sent
            const { error } = await supabase
                .from('push_notifications')
                .update({ 
                    sent_at: new Date().toISOString(),
                    scheduled_for: null,
                    recipients_count: Math.floor(Math.random() * 100) + 50 // Mock
                })
                .eq('id', id);

            if (error) throw error;
            
            // Update counter
            this.restaurant.notifications_sent_this_month = (this.restaurant.notifications_sent_this_month || 0) + 1;
            await supabase
                .from('restaurants')
                .update({ 
                    notifications_sent_this_month: this.restaurant.notifications_sent_this_month
                })
                .eq('id', this.restaurant.id);
            
            sessionStorage.setItem('restaurant', JSON.stringify(this.restaurant));
            
            await this.loadNotifications();
            this.showSuccess('Notification sent successfully!');
            
        } catch (error) {
            console.error('Error sending notification:', error);
            alert('Error sending notification');
        }
    }

    async cancelNotification(id) {
        try {
            await window.subscriptionManager.logAction('cancel_notification', {
                notification_id: id
            });
            
            const { error } = await supabase
                .from('push_notifications')
                .delete()
                .eq('id', id);

            if (error) throw error;
            await this.loadNotifications();
            
        } catch (error) {
            console.error('Error canceling notification:', error);
            alert('Error canceling notification');
        }
    }

    async checkMonthlyReset() {
        // Check if we need to reset monthly counter based on subscription start date
        if (!this.restaurant.subscription_started_at) return;
        
        const startDate = new Date(this.restaurant.subscription_started_at);
        const now = new Date();
        const billingDay = startDate.getDate();
        
        // Check if today is billing day and we haven't reset this month
        if (now.getDate() === billingDay) {
            const lastReset = this.restaurant.last_notification_reset ? 
                new Date(this.restaurant.last_notification_reset) : startDate;
            
            if (lastReset.getMonth() !== now.getMonth() || 
                lastReset.getFullYear() !== now.getFullYear()) {
                
                // Reset counter
                await supabase
                    .from('restaurants')
                    .update({
                        notifications_sent_this_month: 0,
                        last_notification_reset: now.toISOString()
                    })
                    .eq('id', this.restaurant.id);
                
                this.restaurant.notifications_sent_this_month = 0;
                this.restaurant.last_notification_reset = now.toISOString();
                sessionStorage.setItem('restaurant', JSON.stringify(this.restaurant));
                
                console.log('Monthly notification counter reset');
                this.displayUsageIndicator();
            }
        }
    }

    getNextResetDate() {
        if (!this.restaurant.subscription_started_at) {
            // Default to 1st of next month
            const date = new Date();
            date.setMonth(date.getMonth() + 1);
            date.setDate(1);
            return date;
        }
        
        const startDate = new Date(this.restaurant.subscription_started_at);
        const billingDay = startDate.getDate();
        const now = new Date();
        const nextReset = new Date(now.getFullYear(), now.getMonth(), billingDay);
        
        // If billing day has passed this month, move to next month
        if (nextReset <= now) {
            nextReset.setMonth(nextReset.getMonth() + 1);
        }
        
        // Handle months with fewer days
        if (nextReset.getDate() !== billingDay) {
            nextReset.setDate(0); // Last day of previous month
        }
        
        return nextReset;
    }

    updateNotificationStats() {
        const statsContainer = document.getElementById('notification-stats');
        if (!statsContainer) return;

        const sentThisMonth = this.restaurant.notifications_sent_this_month || 0;
        const scheduled = this.notifications.filter(n => 
            n.scheduled_for && new Date(n.scheduled_for) > new Date()
        ).length;
        const totalSent = this.notifications.filter(n => n.sent_at).length;

        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${sentThisMonth}</div>
                <div class="stat-label">Sent This Month</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${scheduled}</div>
                <div class="stat-label">Scheduled</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalSent}</div>
                <div class="stat-label">Total Sent</div>
            </div>
        `;
    }

    switchTab(tabBtn) {
        // Update tab buttons
        document.querySelectorAll('#notifications-section .tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        tabBtn.classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const tabContent = document.getElementById(`${this.currentTab}-tab`);
        if (tabContent) {
            tabContent.classList.add('active');
        }
    }

    openComposeModal(prefillData = null) {
        console.log('Opening compose modal', prefillData);
        // Implementation for compose modal
    }

    closeComposeModal() {
        const modal = document.getElementById('notification-compose-modal');
        if (modal) modal.style.display = 'none';
    }

    editNotification(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
            this.openComposeModal(notification);
        }
    }

    selectTemplate(templateType) {
        console.log('Selected template:', templateType);
        // Implementation for template selection
    }

    formatDateTime(date) {
        const options = { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        };
        return date.toLocaleDateString('en-US', options);
    }

    formatRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
        if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString();
    }

    showSuccess(message) {
        // Create success notification
        const successDiv = document.createElement('div');
        successDiv.className = 'notification-success';
        successDiv.textContent = message;
        successDiv.style.cssText = `
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
        
        document.body.appendChild(successDiv);
        setTimeout(() => successDiv.remove(), 3000);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.notificationsManager = new NotificationsManager();
    });
} else {
    window.notificationsManager = new NotificationsManager();
}