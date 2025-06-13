//   const product = JSON.parse(document.getElementById('product-data').textContent)
//   const variants = product.variants;
//   let currentIndex = 0;

//   // DOM Elements
//   const priceEl = document.getElementById("product-price");
//   const descEl = document.getElementById("product-description");
//   const stockEl = document.getElementById("stock-status");
//   const mainImage = document.getElementById("main-product-image");
//   const thumbnailWrapper = document.getElementById("thumbnail-wrapper");
//   const variantBtns = document.querySelectorAll(".variant-btn");

//   // Update product details when a variant is selected
//   function updateVariant(index) {
//     const variant = variants[index];
//     currentIndex = index;

//     // Update active class
//     variantBtns.forEach((btn) => btn.classList.remove("active"));
//     const activeBtn = document.querySelector(`.variant-btn[data-index="${index}"]`);
//     if (activeBtn) activeBtn.classList.add("active");

//     // Update product info
//     priceEl.textContent = `₹${variant.price}`;
//     descEl.textContent = variant.description;
//     stockEl.textContent = variant.stock > 0 ? "In Stock" : "Out of Stock";
//     stockEl.className = variant.stock > 0 ? "text-success" : "text-danger";

//     // Update main image
//     mainImage.src = variant.images[0];

//     // Update thumbnails
//     thumbnailWrapper.innerHTML = "";
//     variant.images.forEach((img, i) => {
//       const thumb = document.createElement("img");
//       thumb.src = img;
//       thumb.className = "thumbnail-image";
//       thumb.alt = `Thumbnail ${i + 1}`;
//       thumb.onclick = () => {
//         mainImage.src = img;
//       };
//       thumbnailWrapper.appendChild(thumb);
//     });
//   }

//   // Attach click handlers to volume buttons
//   variantBtns.forEach((btn) => {
//     btn.addEventListener("click", () => {
//       const index = parseInt(btn.dataset.index);
//       updateVariant(index);
//     });
//   });

//   // Initial setup
//   updateVariant(0);
