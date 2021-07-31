const router = require('express').Router();
const sequelize = require('../../config/connection');
const { Tag, Product, ProductTag } = require('../../models');

// The `/api/tags` endpoint

router.get('/', async (req, res) => {
  // find all tags
  // be sure to include its associated Product data
  try {
    const tagData = await Tag.findAll({
      include: [
        {
          model: Product,
          attributs: ['product_name'],
          through: {
            model: ProductTag,
          },
        },
      ],
    });
    if (!tagData) {
      res.status({ message: 'No tag in the database!' });
      return;
    }
    res.status(200).json(tagData);
  } catch (err) {
    res.status(500).json(err);
  }
});

router.get('/:id', async (req, res) => {
  // find a single tag by its `id`
  // be sure to include its associated Product data
  try {
    const tagData = await Tag.findByPk(req.params.id, {
      include: [
        {
          model: Product,
          attributes: ['product_name'],
          through: {
            model: ProductTag,
          },
        },
      ],
    });
    if (!tagData) {
      res.status(404).json({ message: 'No tag with this id!' });
      return;
    }
    res.status(200).json(tagData);
  } catch (err) {
    res.status(500).json(err);
  }
});

router.post('/', (req, res) => {
  // create a new tag
  Tag.create(req.body)
    .then((tag) => {
      // if there's product tags, we need to create pairings to bulk create in the ProductTag model
      if (req.body.productIds.length) {
        const productTagIdArr = req.body.productIds.map((product_id) => {
          return {
            product_id,
            tag_id: tag.id,
          };
        });
        return ProductTag.bulkCreate(productTagIdArr);
      }
      // if no product tags, just respond
      res.status(200).json(tag);
    })
    .then((productTagIds) => res.status(200).json(productTagIds))
    .catch((err) => {
      console.log(err);
      res.status(400).json(err);
    });
});

router.put('/:id', (req, res) => {
  // update a tag's name by its `id` value
  // update product data
  Tag.update(req.body, {
    where: {
      id: req.params.id,
    },
  })
    .then((tag) => {
      // find all associated tags from ProductTag
      return ProductTag.findAll({ where: { tag_id: req.params.id } });
    })
    .then((productTags) => {
      // get list of current tag_ids
      const productTagIds = productTags.map(({ product_id }) => product_id);
      console.log('productTagIds', productTagIds);

      // create filtered list of new tag_ids
      const newProductTags = req.body.productIds
        // select from the array of input tag ids those that are not included in the array of tag ids that are already tied to the product, and add them to the product
        // and create a new array based the above selection
        .filter((product_id) => !productTagIds.includes(product_id))
        .map((product_id) => {
          return {
            product_id,
            tag_id: req.params.id,
          };
        });
      // figure out which ones to remove
      const productTagsToRemove = productTags
        // select from array of tag ids already tied to the product those that are not included in the array of input tag ids
        // and create a new array based the above selection
        .filter(({ product_id }) => !req.body.productIds.includes(product_id))
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
  // delete on tag by its `id` value
  var message = await dropForeignKey();

  ProductTag.findAll({ where: { tag_id: req.params.id } })
    .then((productTags) => {
      const productTagIds = productTags.map(({ id }) => id);
      console.log('productTagIds', productTagIds);
      return Promise([ProductTag.destroy({ where: { id: productTagIds } })]);
    })
    .then((updatedProductTags) => {
      sequelize.literal(
        '( ALTER TABLE product_tag ADD FOREIGN KEY(product_id)), ADD FOREIGN KEY(tag_id) )'
      );
      res.json(updatedProductTags);
    })
    .catch((err) => {
      res.status(400).json(err);
    });
});

module.exports = router;
