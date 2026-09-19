import "dotenv/config";

const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN!;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;
const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2025-07";

const query = /* GraphQL */ `
  query {
    codeDiscountNodes(first: 10) {
      edges {
        node {
          id
          codeDiscount {
            ... on DiscountCodeBasic {
              title
              status
              startsAt
              endsAt
              usageLimit
              appliesOncePerCustomer
              combinesWith { orderDiscounts productDiscounts shippingDiscounts }
              codes(first: 5) {
                edges { node { code } }
              }
            }
          }
        }
      }
    }
  }
`;

fetch(`https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": ACCESS_TOKEN,
  },
  body: JSON.stringify({ query }),
})
  .then((r) => r.json())
  .then((data) => console.log(JSON.stringify(data, null, 2)))
  .catch((err) => console.error(err));
