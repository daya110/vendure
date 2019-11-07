import gql from 'graphql-tag';

export const ADMINISTRATOR_FRAGMENT = gql`
    fragment Administrator on Administrator {
        id
        firstName
        lastName
        emailAddress
        user {
            id
            identifier
            lastLogin
            roles {
                id
                code
                description
                permissions
            }
        }
    }
`;

export const ASSET_FRAGMENT = gql`
    fragment Asset on Asset {
        id
        name
        fileSize
        mimeType
        type
        preview
        source
    }
`;

export const PRODUCT_VARIANT_FRAGMENT = gql`
    fragment ProductVariant on ProductVariant {
        id
        enabled
        languageCode
        name
        price
        currencyCode
        priceIncludesTax
        priceWithTax
        stockOnHand
        trackInventory
        taxRateApplied {
            id
            name
            value
        }
        taxCategory {
            id
            name
        }
        sku
        options {
            id
            code
            languageCode
            name
        }
        facetValues {
            id
            code
            name
            facet {
                id
                name
            }
        }
        featuredAsset {
            ...Asset
        }
        assets {
            ...Asset
        }
        translations {
            id
            languageCode
            name
        }
    }
    ${ASSET_FRAGMENT}
`;

export const PRODUCT_WITH_VARIANTS_FRAGMENT = gql`
    fragment ProductWithVariants on Product {
        id
        enabled
        languageCode
        name
        slug
        description
        featuredAsset {
            ...Asset
        }
        assets {
            ...Asset
        }
        translations {
            languageCode
            name
            slug
            description
        }
        optionGroups {
            id
            languageCode
            code
            name
        }
        variants {
            ...ProductVariant
        }
        facetValues {
            id
            code
            name
            facet {
                id
                name
            }
        }
        channels {
            id
            code
        }
    }
    ${PRODUCT_VARIANT_FRAGMENT}
    ${ASSET_FRAGMENT}
`;

export const ROLE_FRAGMENT = gql`
    fragment Role on Role {
        id
        code
        description
        permissions
        channels {
            id
            code
            token
        }
    }
`;

export const CONFIGURABLE_FRAGMENT = gql`
    fragment ConfigurableOperation on ConfigurableOperation {
        args {
            name
            type
            value
        }
        code
    }
`;

export const COLLECTION_FRAGMENT = gql`
    fragment Collection on Collection {
        id
        name
        description
        isPrivate
        languageCode
        featuredAsset {
            ...Asset
        }
        assets {
            ...Asset
        }
        filters {
            ...ConfigurableOperation
        }
        translations {
            id
            languageCode
            name
            description
        }
        parent {
            id
            name
        }
        children {
            id
            name
        }
    }
    ${ASSET_FRAGMENT}
    ${CONFIGURABLE_FRAGMENT}
`;

export const FACET_VALUE_FRAGMENT = gql`
    fragment FacetValue on FacetValue {
        id
        languageCode
        code
        name
        translations {
            id
            languageCode
            name
        }
        facet {
            id
            name
        }
    }
`;

export const FACET_WITH_VALUES_FRAGMENT = gql`
    fragment FacetWithValues on Facet {
        id
        languageCode
        isPrivate
        code
        name
        translations {
            id
            languageCode
            name
        }
        values {
            ...FacetValue
        }
    }
    ${FACET_VALUE_FRAGMENT}
`;

export const COUNTRY_FRAGMENT = gql`
    fragment Country on Country {
        id
        code
        name
        enabled
        translations {
            id
            languageCode
            name
        }
    }
`;

export const ADDRESS_FRAGMENT = gql`
    fragment Address on Address {
        id
        fullName
        company
        streetLine1
        streetLine2
        city
        province
        postalCode
        country {
            id
            code
            name
        }
        phoneNumber
        defaultShippingAddress
        defaultBillingAddress
    }
`;

export const CUSTOMER_FRAGMENT = gql`
    fragment Customer on Customer {
        id
        title
        firstName
        lastName
        phoneNumber
        emailAddress
        user {
            id
            identifier
            verified
            lastLogin
        }
        addresses {
            ...Address
        }
    }
    ${ADDRESS_FRAGMENT}
`;

export const ADJUSTMENT_FRAGMENT = gql`
    fragment Adjustment on Adjustment {
        adjustmentSource
        amount
        description
        type
    }
`;

export const SHIPPING_ADDRESS_FRAGMENT = gql`
    fragment ShippingAddress on OrderAddress {
        fullName
        company
        streetLine1
        streetLine2
        city
        province
        postalCode
        country
        phoneNumber
    }
`;

export const ORDER_FRAGMENT = gql`
    fragment Order on Order {
        id
        createdAt
        updatedAt
        code
        state
        total
        currencyCode
        customer {
            id
            firstName
            lastName
        }
    }
`;

export const ORDER_ITEM_FRAGMENT = gql`
    fragment OrderItem on OrderItem {
        id
        cancelled
        unitPrice
        unitPriceIncludesTax
        unitPriceWithTax
        taxRate
        fulfillment {
            id
        }
    }
`;

export const ORDER_WITH_LINES_FRAGMENT = gql`
    fragment OrderWithLines on Order {
        id
        createdAt
        updatedAt
        code
        state
        active
        customer {
            id
            firstName
            lastName
        }
        lines {
            id
            featuredAsset {
                preview
            }
            productVariant {
                id
                name
                sku
            }
            unitPrice
            unitPriceWithTax
            quantity
            items {
                ...OrderItem
            }
            totalPrice
        }
        adjustments {
            ...Adjustment
        }
        subTotal
        subTotalBeforeTax
        totalBeforeTax
        currencyCode
        shipping
        shippingMethod {
            id
            code
            description
        }
        shippingAddress {
            ...ShippingAddress
        }
        payments {
            id
            transactionId
            amount
            method
            state
            metadata
        }
        total
    }
    ${ADJUSTMENT_FRAGMENT}
    ${SHIPPING_ADDRESS_FRAGMENT}
    ${ORDER_ITEM_FRAGMENT}
`;

export const PROMOTION_FRAGMENT = gql`
    fragment Promotion on Promotion {
        id
        createdAt
        updatedAt
        couponCode
        startsAt
        endsAt
        name
        enabled
        conditions {
            ...ConfigurableOperation
        }
        actions {
            ...ConfigurableOperation
        }
    }
    ${CONFIGURABLE_FRAGMENT}
`;

export const ZONE_FRAGMENT = gql`
    fragment Zone on Zone {
        id
        name
        members {
            ...Country
        }
    }
    ${COUNTRY_FRAGMENT}
`;

export const TAX_RATE_FRAGMENT = gql`
    fragment TaxRate on TaxRate {
        id
        name
        enabled
        value
        category {
            id
            name
        }
        zone {
            id
            name
        }
        customerGroup {
            id
            name
        }
    }
`;
export const CURRENT_USER_FRAGMENT = gql`
    fragment CurrentUser on CurrentUser {
        id
        identifier
        channels {
            code
            token
            permissions
        }
    }
`;
export const VARIANT_WITH_STOCK_FRAGMENT = gql`
    fragment VariantWithStock on ProductVariant {
        id
        stockOnHand
        stockMovements {
            items {
                ... on StockMovement {
                    id
                    type
                    quantity
                }
            }
            totalItems
        }
    }
`;
