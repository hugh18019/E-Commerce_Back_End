const router = require('express').Router();
const sequelize = require('../../config/connection');
const { Product, Category, Tag, ProductTag } = require('../../models');

// The `/api/products` endpoint

// get all products
router.get('/', async (req, res) => {
  // find all products
  // be sure to include its associated Category and Tag data
  console.log('req', req);
  try {
    const productData = await Product.findAll({
      include: [
        { model: Category },
        {
          model: Tag,
          attributs: ['tag_name'],
          through: {
            model: ProductTag,
          },
        },
      ],
    });
    if (!productData) {
      res.status({ message: 'No product in the database!' });
      return;
    }
    res.status(200).json(productData);
  } catch (err) {
    res.status(500).json(err);
  }
});

// get one product
router.get('/:id', async (req, res) => {
  // find a single product by its `id`
  // be sure to include its associated Category and Tag data
  try {
    const productData = await Product.findByPk(req.params.id, {
      include: [
        { model: Category },
        {
          model: Tag,
          attributes: ['tag_name'],
          through: {
            model: ProductTag,
          },
        },
      ],
    });
    if (!productData) {
      res.status(404).json({ message: 'No product with this id!' });
      return;
    }
    res.status(200).json(productData);
  } catch (err) {
    res.status(500).json(err);
  }
});

// create new product
router.post('/', (req, res) => {
  /* req.body should look like this...
    {
      product_name: "Basketball",
      price: 200.00,
      stock: 3,
      tagIds: [1, 2, 3, 4]
    }
  */
  Product.create(req.body)
    .then((product) => {
      // if there's product tags, we need to create pairings to bulk create in the ProductTag model
      if (req.body.tagIds.length) {
        const productTagIdArr = req.body.tagIds.map((tag_id) => {
          return {
            product_id: product.id,
            tag_id,
          };
        });
        return ProductTag.bulkCreate(productTagIdArr);
      }
      // if no product tags, just respond
      res.status(200).json(product);
    })
    .then((productTagIds) => res.status(200).json(productTagIds))
    .catch((err) => {
      console.log(err);
      res.status(400).json(err);
    });
});

// update product
router.put('/:id', (req, res) => {
  // update product data
  Product.update(req.body, {
    where: {
      id: req.params.id,
    },
  })
    .then((product) => {
      // find all associated tags from ProductTag
      return ProductTag.findAll({ where: { product_id: req.params.id } });
    })
    .then((productTags) => {
      // get list of current tag_ids
      const productTagIds = productTags.map(({ tag_id }) => tag_id);
      // create filtered list of new tag_ids
      const newProductTags = req.body.tagIds
        // select from the array of input tag ids those that are not included in the array of tag ids that are already tied to the product, and add them to the product
        // and create a new array based the above selection
        .filter((tag_id) => !productTagIds.includes(tag_id))
        .map((tag_id) => {
          return {
            product_id: req.params.id,
            tag_id,
          };
        });
      // figure out which ones to remove
      const productTagsToRemove = productTags
        // select from array of tag ids already tied to the product those that are not included in the array of input tag ids
        // and create a new array based the above selection
        .filter(({ tag_id }) => !req.body.tagIds.includes(tag_id))
        .map(({ id }) => id);

      // run both actions
      return Promise.all([
        ProductTag.destroy({ where: { id: productTagsToRemove } }),
        ProductTag.bulkCreate(newProductTags),
      ]);
    })
    .then((updatedProductTags) => res.json(updatedProductTags))
    .catch((err) => {
      // console.log(err);
      res.status(400).json(err);
    });
});

function dropForeignKey() {
  return new Promise((resolve, reject) => {
    sequelize.literal(
      '(ALTER TABLE product_tag DROP FOREIGN KEY(product_id)), DROP FOREIGN KEY(tag_id))'
    );
    resolve('done');
  });
}

router.delete('/:id', async (req, res) => {
  var message = await dropForeignKey();

  ProductTag.findAll({ where: { product_id: req.params.id } })
    .then((productTags) => {
      const productTagIds = productTags.map(({ id }) => id);
      console.log('productTagIds', productTagIds);
      return Promise([ProductTag.destroy({ where: { id: productTagIds } })]);
    })
    .then((updatedProductTags) => {
      console.log('updatedProductTags', updatedProductTags);
      sequelize.literal(
        '( ALTER TABLE product_tag ADD FOREIGN KEY(product_id)), ADD FOREIGN KEY(tag_id) )'
      );
      res.json(updatedProductTags);
    })
    .catch((err) => {
      res.status(400).json(err);
    });

  // delete one product by its `id` value
  // Product.destroy({
  //   where: {
  //     id: req.params.id,
  //   },
  // })
  //   .then((product) => {
  //     return ProductTag.findAll({ where: { product_id: req.params.id } });
  //   })
  //   .then((productTags) => {
  //     const ProductTagsToRemove = productTags;
  //     return Promise([ProductTag.beforeBulkDestroy(ProductTagsToRemove)]);
  //   })
  //   .then((updatedProductTags) => res.json(updatedProductTags))
  //   .catch((err) => {
  //     res.status(400).json(err);
  //   });
});

module.exports = router;
