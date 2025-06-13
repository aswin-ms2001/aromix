document.addEventListener("DOMContentLoaded", () => {
    const ctx = document.getElementById('ordersChart').getContext('2d');

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['16', '18', '20', '22', '24', '26', '28', '30', '02', '04', '06'],
            datasets: [{
                label: 'Orders',
                data: [1000, 1500, 1200, 1100, 1800, 2400, 2100, 2500, 1700, 2000, 2300],
                borderColor: '#8e44ad',
                backgroundColor: 'rgba(142, 68, 173, 0.2)',
                fill: true,
                tension: 0.4
            }]
        }
    });
});

