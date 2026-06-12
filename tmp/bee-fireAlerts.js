async function fireAlerts(notifications, customAlerts = {}) {
    const alerts = notifications.map(notification => {
        for (notificationMessage in customAlerts)
            if (notification.message == notificationMessage)
                return customAlerts[notificationMessage]
        return {
            icon: notification.level == 'danger' ? 'error' : notification.level,
            title: notification.message,
        }
    })
    for (alert of alerts) await Swal.fire(alert)
}
